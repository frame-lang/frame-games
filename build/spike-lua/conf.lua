-- LÖVE config — fixed 800x600 design surface (the love.js HTML wrapper scales
-- the canvas to fit, keeping aspect). Unused modules off to slim the web build.
function love.conf(t)
    t.identity = "asteroids"
    t.window.title = "Asteroids"
    t.window.width = 800
    t.window.height = 600
    t.window.resizable = false
    t.modules.audio = false
    t.modules.sound = false
    t.modules.physics = false
    t.modules.joystick = false
    t.modules.touch = false
end
