const canvas = document.getElementById("graphicsCanvas");
const ctx = canvas.getContext("2d");

ctx.fillStyle = "red";
ctx.fillRect(0, 0, 10, 10);

ctx.fillStyle = "blue";
ctx.fillRect(100, 100, 10, 10);

ctx.fillStyle = "green";
ctx.fillRect(400, 250, 10, 10);