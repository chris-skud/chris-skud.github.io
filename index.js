const express = require('express')
const app = express()
const port = 9000
app.use(express.static('stageplot2'))

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})