import express from 'express'
import logger from 'morgan'
import dotenv from 'dotenv'
import { createClient } from '@libsql/client'
import { Server } from 'socket.io'
import { createServer } from 'node:http'

dotenv.config()
const port = process.env.PORT ?? 3000

const app = express()
const server = createServer(app)
const io = new Server(server, {
  connectionStateRecovery: {},
})

const db = createClient({
  url: 'libsql://useful-black-queen-maurivenegas.turso.io',
  authToken: process.env.DB_TOKEN,
})

await db.execute(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    user TEXT
  )
`)

io.on('connection', async (socket) => {
  console.log('An user has connected!')

  socket.on('disconnect', () => {
    console.log('An user has disconnected!')
  })

  socket.on('chat message', async (msg) => {
    let result
    let username = socket.handshake.auth.username ?? 'anonymous'
    try {
      result = await db.execute({
        sql: `INSERT INTO messages (content, user) VALUES (:msg, :username)`,
        args: { msg, username },
      })
    } catch (e) {
      console.error(e)
      return
    }
    io.emit('chat message', msg, result.lastInsertRowid.toString(), username)
  })

  if (!socket.recovered) {
    try {
      const result = await db.execute({
        sql: `SELECT id, content, user FROM messages WHERE id > ? `,
        args: [socket.handshake.auth.serverOffSet ?? 0],
      })
      result.rows.forEach((row) => {
        socket.emit('chat message', row.content, row.id.toString(), row.user)
      })
    } catch (e) {}
  }
})
app.use(logger('dev'))

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(port, () => {
  console.log(`Server running on port ${port}`)
})