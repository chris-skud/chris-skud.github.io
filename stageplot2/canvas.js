const getMouseLocal = (mouseX, mouseY, x, y, scale, rot) => {
  let xdx = Math.cos(rotate) * scale; // create the x axis
  let xdy = Math.sin(rotate) * scale;

  // get the cross product of the two axies     
  let cross = xdx * xdx - xdy * -xdy;
  // or
  // let cross = Math.pow(xdx,2) + Math.pow(xdy,2);

  // then create the inverted axies 
  let ixdx = xdx / cross;   // create inverted x axis
  let ixdy = -xdy / cross;
  let iydx = xdy / cross;   // create inverted y axis
  let iydy = xdx / cross;

  // now remove the origin from the mouse coords
  mouseX -= x;
  mouseY -= y;

  // multiply by the invers matrix    
  let localMouseX = mouseX * ixdx + mouseY * iydx;
  let localMouseY = mouseX * ixdy + mouseY * iydy;

  // and return the result
  return {x : localMouseX, y : localMouseY};
}

export {getMouseLocal};