let canvas = null;
const deleteIcon = "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3C!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'%3E%3Csvg version='1.1' id='Ebene_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' width='595.275px' height='595.275px' viewBox='200 215 230 470' xml:space='preserve'%3E%3Ccircle style='fill:%23F44336;' cx='299.76' cy='439.067' r='218.516'/%3E%3Cg%3E%3Crect x='267.162' y='307.978' transform='matrix(0.7071 -0.7071 0.7071 0.7071 -222.6202 340.6915)' style='fill:white;' width='65.545' height='262.18'/%3E%3Crect x='266.988' y='308.153' transform='matrix(0.7071 0.7071 -0.7071 0.7071 398.3889 -83.3116)' style='fill:white;' width='65.544' height='262.179'/%3E%3C/g%3E%3C/svg%3E";
const deleteImg = document.createElement('img');
deleteImg.src = deleteIcon;
        
const init = () => {
  canvas = this.__canvas = new fabric.Canvas('c');
  window.addEventListener('resize', resizeCanvas, false);

  function resizeCanvas() {
      // canvas.setHeight(window.innerHeight);
      canvas.setWidth(window.innerWidth);
      canvas.renderAll();
  }

  // resize on init
  resizeCanvas();

  fabric.Object.prototype.transparentCorners = false;
  fabric.Object.prototype.cornerColor = 'gray';
  fabric.Object.prototype.cornerStyle = 'circle';

  fabric.Object.prototype.controls.deleteControl = new fabric.Control({
      x: 0.5,
      y: -0.5,
      offsetY: -16,
      offsetX: 16,
      cursorStyle: 'pointer',
      mouseUpHandler: deleteObject,
      render: renderIcon(deleteImg),
      cornerSize: 24
  });

  loadData();
}

const add = (elem) => {
  const imgInstance = new fabric.Image(elem, {
      left: 100,
      top: 100,
  });
  canvas.add(imgInstance);
}

const deleteObject = (eventData, transform) => {
  const target = transform.target;
  const canvas = target.canvas;
  canvas.remove(target);
  canvas.requestRenderAll();
}
const renderIcon = (icon) => {
  return function renderIcon(ctx, left, top, styleOverride, fabricObject) {
      const size = this.cornerSize;
      ctx.save();
      ctx.translate(left, top);
      ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
      ctx.drawImage(icon, -size/2, -size/2, size, size);
      ctx.restore();
  }
}
const setLocalStorage = () => {
  const state = getPageState();
  localStorage.setItem("state", JSON.stringify(state));
  console.log(state);
}

const loadData = () => {
  let state = null;
  const u = new URL(window.location.href);
  if (!u.searchParams.has("s")) {
      if (typeof localStorage["state"] !== "undefined") {
        state = JSON.parse(localStorage["state"]);
        console.log(`geting from localstorage: ${state}`);
      }
  } else {
    // state = JSON.parse(atob(u.searchParams.get("s")));
    state = JSON.parse(LZString.LZString.decompressFromEncodedURIComponent(u.searchParams.get("s")));
    console.log(`geting from url: ${state}`);
  }
  
  window.history.replaceState('', 'Stageplot', 'https://chris-skud.github.io/stageplot2');

  document.getElementById("name").value = state.name;
  document.getElementById("venue").value = state.venue;
  document.getElementById("date").value = state.date;
  document.getElementById("notes").value = state.notes;
  const inputs = state.inputs;
  const container = document.getElementById('inputs');
  const elems = container.getElementsByTagName('input');
  for (let i = 0; i < inputs.length; i++) {
      document.getElementById(inputs[i].id).value = inputs[i].value ?? '';
  }
}

const share = () => {
  const state = LZString.compressToEncodedURIComponent(JSON.stringify(getPageState()));
  console.log("Size of compressed sample is: " + state.length);
  // const state = btoa(JSON.stringify(getPageState()));
  // console.log("otherwise " + state.length);
  const url = "https://chris-skud.github.io/stageplot2?s="+state;
  console.log(state);
  navigator.clipboard.writeText(url);
}

const getPageState = () => {
  const data = {
    name: document.getElementById("name").value,
    venue: document.getElementById("venue").value,
    date: document.getElementById("date").value,
    notes: document.getElementById("notes").value,
  };

  let inputs = [];
  const elems = document.getElementById('inputs').getElementsByTagName('input');
  for (let i = 0; i < elems.length -1; i++) {
      if (elems[i].value !== "") {
          let fObj = {id: elems[i].id, value: elems[i].value};
          inputs.push(fObj);
      }       
  }
  data['inputs'] = inputs;
  return data;
}
