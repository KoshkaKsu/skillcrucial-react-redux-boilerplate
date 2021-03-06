import express from 'express'
import path from 'path'
import cors from 'cors'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'
import { renderToStaticNodeStream } from 'react-dom/server'
import React from 'react'
import axios from 'axios'

import cookieParser from 'cookie-parser'
import config from './config'
import Html from '../client/html'

const Root = () => ''

const { readFile, writeFile, unlink } = require('fs').promises

try {
  // eslint-disable-next-line import/no-unresolved
  // ;(async () => {
  //   const items = await import('../dist/assets/js/root.bundle')
  //   console.log(JSON.stringify(items))

  //   Root = (props) => <items.Root {...props} />
  //   console.log(JSON.stringify(items.Root))
  // })()
  console.log(Root)
} catch (ex) {
  console.log(' run yarn build:prod to enable ssr')
}

let connections = []

const port = process.env.PORT || 8090
const server = express()

const setHeader = (req, res, next) => {
  res.set('x-skillcrucial-user', '385666b1-bff5-11e9-95ba-1bf845c18f8d')
  res.set('Access-Control-Expose-Headers', 'X-SKILLCRUCIAL-USER')
  next ()
}

const middleware = [
  cors(),
  express.static(path.resolve(__dirname, '../dist/assets')),
  bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  bodyParser.json({ limit: '50mb', extended: true }),
  cookieParser(),
  setHeader
]

middleware.forEach((it) => server.use(it))

function fileExist() {
  const bigData = readFile(`${__dirname}/users.json`)
  .then((file) => {
    return JSON.parse(file)
  })
  .catch(async () => {
    const response = await axios('https://jsonplaceholder.typicode.com/users')
      .then(res => res.data)
    response.sort((a, b) => a.id - b.id)
    writeFile(`${__dirname}/users.json`, JSON.stringify(response), { encoding: 'utf8' })
    return response
  }) 
  return bigData
}

function toWriteFile(fileData) {
  writeFile(`${__dirname}/users.json`, JSON.stringify(fileData), 'utf8')
}

server.get('/api/v1/users', async (req, res) => {
  const newData = await fileExist()
  res.json(newData)
})

/*
post /api/v1/users - добавляет юзера в файл users.json, 
с id равным id последнего элемента + 1 и возвращает {status: 'success', id: id}
*/

server.post('/api/v1/users', async (req, res) => {
  const newUser = req.body
  const userData = await fileExist()
  newUser.id = (userData.length === 0) ? 1 : userData[userData.length - 1].id + 1
  toWriteFile([...userData, newUser])
  res.json({status: 'success', id: newUser.id})
})

/*
patch /api/v1/users/:userId - дополняет юзера в users.json с id равным userId и 
возвращает { status: 'success', id: userId }
*/

server.patch('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  const newUser = req.body
  const arr = await fileExist() 
  const objId = arr.find((obj) => obj.id === +userId)
  const objId2 = { ...objId, ...newUser }
  const arr2 = arr.map((rec) => rec.id === objId2.id ? objId2 : rec)
  toWriteFile(arr2)
  res.json({ status: 'success', id: userId })
})

/*
delete /api/v1/users/:userId - удаляет юзера в users.json с id равным userId и 
возвращает { status: 'success', id: userId }
*/

server.delete('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  const arr = await fileExist() 
  const objId = arr.find((obj) => obj.id === +userId)
  const arr2 = arr.filter((rec) => rec.id !== objId.id)
  toWriteFile(arr2)
  res.json({ status: 'success', id: userId })
})

// delete /api/v1/users/ - удаляет файл users.json

server.delete('/api/v1/users/', (req, res) => {
  unlink(`${__dirname}/users.json`)
    .then(() => res.json({ status: 'success' }))
    .catch(() => res.send('no file'))
})

server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const [htmlStart, htmlEnd] = Html({
  body: 'separator',
  title: 'Skillcrucial - Become an IT HERO'
}).split('separator')

server.get('/', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

server.get('/*', (req, res) => {
  const initialState = {
    location: req.url
  }

  return res.send(
    Html({
      body: '',
      initialState
    })
  )
})

const app = server.listen(port)

if (config.isSocketsEnabled) {
  const echo = sockjs.createServer()
  echo.on('connection', (conn) => {
    connections.push(conn)
    conn.on('data', async () => {})

    conn.on('close', () => {
      connections = connections.filter((c) => c.readyState !== 3)
    })
  })
  echo.installHandlers(app, { prefix: '/ws' })
}
console.log(`Serving at http://localhost:${port}`)


// Создать следующее api:
// 1)get /api/v1/users - получает всех юзеров из файла users.json, если его нет - получает данные с сервиса https://jsonplaceholder.typicode.com/users и заполняет файл users.json y и возвращает данные

// 2)post /api/v1/users - добавляет юзера в файл users.json, с id равным id последнего элемента + 1 и возвращает {status: 'success', id: id}
// 3)patch /api/v1/users/:userId - дополняет юзера в users.json с id равным userId и возвращает { status: 'success', id: userId }

// 4)delete /api/v1/users/:userId - удаляет юзера в users.json с id равным userId и возвращает { status: 'success', id: userId }
// 5)delete /api/v1/users/ - удаляет файл users.json