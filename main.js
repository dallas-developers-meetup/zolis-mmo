var socket = io.connect('http://localhost'),
  $ = document.querySelector.bind(document),
  id, arena;

canvas = $('#c')
canvas.width = 800
canvas.height = 600
ctx = canvas.getContext('2d')

image = new Image()
image.src = 'player.png'
image.onload = initialize

ctx.webkitImageSmoothingEnabled = false
ctx.mozImageSmoothingEnabled = false
ctx.translate(canvas.width / 2, canvas.height / 2)
ctx.scale(4, 4)
//ctx.scale(2,2)

socket.on('taken', taken)
// on id, set id for user tracking purposes
socket.on('id', function (d) {
  id = d
  hideInstructions()
})
// on death, draw instructios
socket.on('dead', drawInstructions)
// on game data, display on canvas
socket.on('state', gameState)
// on item diff data, update item list
socket.on('item', function (diff) {
  console.log('got item diff', diff)
  if(diff.del) {
    items.splice(diff.index,1)
  } else {
    items[diff.index] = diff.val
  }
})

var items = []
var alerts = []
socket.on('setItems', function(serverItems) {
  items = serverItems
})

socket.on('alert', function alert(msg) {
  // split alert string into many msgs
  while(msg) {
    var m = msg.substr(0,30)
    msg = msg.substring(30)
    alerts.push({msg:m, time: 200})
  }
})

// on keypress, send command to server
// left, up, right, down, space, z
var keys = [37, 38, 39, 40, 32, 90]
window.onkeydown = function (e) {
  keys.indexOf(e.which) != -1 && socket.emit('keydown', e.which)
}
window.onkeyup = function (e) {
  keys.slice(0, 4).indexOf(e.which) != -1 && socket.emit('keyup', e.which)
}

// start by drawing instructions (+ name inputs over canvas?)
function drawInstructions() {
  $('#overlay').style.display = 'block'
}

function hideInstructions() {
  $('#overlay').style.display = 'none'
}

function initialize() {
  $('form').onsubmit = join

  //debug
  $('#name').value = 'Zolmeister'
  join({
    preventDefault: function () {}
  })
}

function join(e) {
  e.preventDefault()
  var name = $('#name').value
  if (/^[a-zA-Z]+$/.test(name)) {
    console.log('joining as', name)
    socket.emit('join', name)
    //taken(name)
    return
  }
  badName(name)
}

function taken(name) {
  $('#red').style.visibility = 'visible'
  $('#taken').innerText = name + ' is dead or taken'
}

function badName(name) {
  $('#red').style.visibility = 'visible'
  $('#taken').innerText = 'Only letters allowed'
}
// as soon as user id appears in player list, remove instructions


//game

function draw() {
  //ctx.restore()
  ctx.clearRect(-canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height)
  var players = arena && arena.players

  id = id || players && players[0] && players[0].id
  if (!id) return
  var me;

  ctx.fillStyle = '#fff'
  for (var i = 0; i < players.length; i++) {
    var player = players[i]
    if (player.id == id) me = player
  }
  if(!me) return

  //draw terrain
  drawTerrain(me.x, me.y)

  // draw items
  drawItems(me.x, me.y)
  
  //draw bullets
  drawBullets(me.x, me.y)

  //ctx.save()
  //ctx.translate(canvas.width/2, canvas.height/2)
  for (var i = 0; i < players.length; i++) {
    var player = players[i]
    // draw player
    drawPlayer(player.x - me.x - 11, player.y - me.y - 5, player.name, player.health, player.dir, player.frame, player.weapon)
    //ctx.fillRect((player.x - me.x), (player.y - me.y), 10, 10)
  }
  
  drawMap(me.x, me.y)
  drawAlerts()
}

function drawMap(x, y) {
  ctx.strokeStyle='#222'
  ctx.strokeRect(400/4 - 31, 300/4 - 31, 30, 30)
  
  // draw zones
  for(var i=0;i<3;i++) {
    for(var j=0;j<3;j++) {
      if(arena.killZone.x == j && arena.killZone.y == i) {
        ctx.fillStyle = '#b00'
        ctx.fillRect(400/4 - 31 + 10*j, 300/4 - 31 + 10*i, 10, 10)
      } else if (arena.nextKillZone.x == j && arena.nextKillZone.y == i){
        ctx.fillStyle = 'rgba(200,0,0,0.3)'
        ctx.fillRect(400/4 - 31 + 10*j, 300/4 - 31 + 10*i, 10, 10)
      }
      ctx.fillStyle = '#fa2'
      ctx.strokeRect(400/4 - 31 + 10*j, 300/4 - 31 + 10*i, 10, 10)
    }
  }
  
  // draw player dot
  ctx.fillRect(400/4 - 30 + (x+400)/28, 300/4 - 30 + (y+300)/21, 1, 1)
}

function drawAlerts() {
  for(var i=alerts.length-1; i>=0;i--) {
    var alert = alerts[i]
    alert.time--
    if(alert.time<=0){
      alerts.splice(i,1)
      continue
    }
    ctx.font = '5px sans'
    ctx.fillStyle = '#faa'
    ctx.fillText(alert.msg, (400 - 345)/4, (-300+30+5*4*i)/4)
  }
}

var random = (function rng() {
  var x = 123456789,
    y = 362436069,
    z = 521288629,
    w = 88675123,
    t;
  return function rand() {
    t = x ^ (x << 11)
    x = y;
    y = z;
    z = w;
    w = w ^ (w >> 19) ^ (t ^ (t >> 8));
    return (w * 2.3283064365386963e-10) * 2;
  }
})()

var map = (function generateMap() {
  var m = []
  for (var y = -canvas.height / 2; y < canvas.height / 2; y += 14) {
    var temp = []
    for (var x = -canvas.width / 2; x < canvas.width / 2; x += 14) {
      var rand = random()
      if (rand > 0.99) {
        temp.push(3)
      } else if (rand > 0.95) {
        temp.push(2)
      } else if (rand > 0.8) {
        temp.push(1)
      } else {
        temp.push(0)
      }
    }
    m.push(temp)
  }
  return m
})()

function drawTerrain(offsetX, offsetY) {
  var row = 0
  var col = 2

  for (var y = -canvas.height / 2; y < canvas.height / 2; y += 14) {
    for (var x = -canvas.width / 2; x < canvas.width / 2; x += 14) {
      if (x - offsetX + 14 < -canvas.width / 4 / 2 || y - offsetY + 14 < -canvas.height / 4 / 2 || y - offsetY > canvas.height / 4 / 2 || y - offsetY > canvas.height / 4 / 2) continue
      ctx.drawImage(image, image.width - col * 14, map[(y + canvas.height / 2) / 14][(x + canvas.width / 2) / 14] * 14, 14, 14, x - offsetX, y - offsetY, 14, 14)
    }
  }
}

function drawItems(offsetX, offsetY) {
  var row = 0
  var col = 1
  for (var i = 0; i < items.length; i++) {
    var item = items[i]
    if (item.x - offsetX + 14 < -canvas.width / 4 / 2 || item.y - offsetY + 14 < -canvas.height / 4 / 2 || item.x - offsetX > canvas.width / 4 / 2 || item.y - offsetY > canvas.height / 4 / 2) continue
    ctx.drawImage(image, image.width - col * 14, item.id * 14, 14, 14, item.x - offsetX, item.y - offsetY, 14, 14)
  }
}

function drawBullets(offsetX, offsetY) {
  var bullets = arena.bullets
  
  var row = 3
  var col = 1
  for (var i = 0; i < bullets.length; i++) {
    var bullet = bullets[i]
    if (bullet.x - offsetX + 14 < -canvas.width / 4 / 2 || bullet.y - offsetY + 14 < -canvas.height / 4 / 2 || bullet.x - offsetX > canvas.width / 4 / 2 || bullet.y - offsetY > canvas.height / 4 / 2) continue
    if(bullet.type==0){
      ctx.save()
      ctx.translate(bullet.x - offsetX + 7, bullet.y - offsetY + 7)
      // left, up, right, down - 0, 1, 2, 3
      var rotate = [1, -.5, 0, .5]
      ctx.rotate(rotate[bullet.dir]*Math.PI)
      ctx.drawImage(image, image.width - col * 14, row * 14, 14, 14, -7, -7, 14, 14)
      ctx.restore()
    } else {
      ctx.fillStyle='#666'
      ctx.fillRect(bullet.x - offsetX+(bullet.dir==1?10:5), bullet.y - offsetY + 7, bullet.dir%2==0? 5: 2, bullet.dir%2==0? 2: 5)
    }
  }
}

function drawPlayer(x, y, name, health, dir, frame, weapon) {

  // 22 x 20, with +10 x-offset
  var row = dir == 0 ? 1 : dir - 1
  var col = frame == 3 ? 1 : frame
  col += (weapon+1)*7
  x += 10

  // draw name
  ctx.fillStyle = '#fff'
  ctx.font = '3px sans'
  ctx.fillText(name, (x - name.length + 12), y - 2)

  // draw health bar
  ctx.fillStyle = '#3a3'
  ctx.fillRect(x + 1, y - 1, health / 5, 1)
  ctx.fillStyle = '#a33'
  ctx.fillRect(x + 1 + health / 5, y - 1, 100 / 5 - health / 5, 1)

  ctx.save()
  if (dir == 0) {
    ctx.translate(44, 0)
    ctx.scale(-1, 1)
    x = 22 - x
  }
  ctx.fillStyle = '#fff'
  //ctx.fillRect(x,y,22,20)

  //draw character
  ctx.drawImage(image, col * 22, row * 20, 22, 20, x, y, 22, 20)
  ctx.restore()

}

function gameState(state) {
  arena = state
  draw()
}