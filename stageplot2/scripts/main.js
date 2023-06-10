// const baseUrl = "https://chris-skud.github.io/stageplot2";
const baseUrl = "http://localhost:9000";
let canvas = null;
const deleteIcon = "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3C!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'%3E%3Csvg version='1.1' id='Ebene_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' width='595.275px' height='595.275px' viewBox='200 215 230 470' xml:space='preserve'%3E%3Ccircle style='fill:%23F44336;' cx='299.76' cy='439.067' r='218.516'/%3E%3Cg%3E%3Crect x='267.162' y='307.978' transform='matrix(0.7071 -0.7071 0.7071 0.7071 -222.6202 340.6915)' style='fill:white;' width='65.545' height='262.18'/%3E%3Crect x='266.988' y='308.153' transform='matrix(0.7071 0.7071 -0.7071 0.7071 398.3889 -83.3116)' style='fill:white;' width='65.544' height='262.179'/%3E%3C/g%3E%3C/svg%3E";
const deleteImg = document.createElement('img');
deleteImg.src = deleteIcon;
        
const init = () => {
  canvas = this.__canvas = new fabric.Canvas('c');
  window.addEventListener('resize', resizeCanvas, false);

  function resizeCanvas() {
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
}

const loadData = () => {
  let state = null;
  const u = new URL(window.location.href);
  if (!u.searchParams.has("s")) {
      if (typeof localStorage["state"] !== "undefined") {
        state = JSON.parse(localStorage["state"]);
      }
  } else {
    state = JSON.parse(LZString.decompressFromEncodedURIComponent(u.searchParams.get("s")));
  }
  
  // clear the session param so there's no confusion about where the data is coming from
  // as once pulled out of session, it's in local storage.
  window.history.replaceState('', 'Stageplot', baseUrl);

  if (state == null) {
    return;
  }
  document.getElementById("name").value = state.name;
  document.getElementById("venue").value = state.venue;
  document.getElementById("date").value = state.date;
  canvas.loadFromJSON(state.stage, canvas.renderAll.bind(canvas));
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
  navigator.clipboard.writeText(baseUrl+"?s="+state);
  // The whole session in the URL is bunch of crap to enable hosting on a static site.
  if ((state.length + baseUrl) > 8201) { // 8201 is max url length supported by github pages
    alert("Hey there awesome person!\n\nThe link we create for you includes all the content from the page which makes sharing it really easy. Unfortunately, there's a limit to how much content the links can support and it appears your big beautiful band is just too much. Your best option is probably going to be to print to PDF through your browser and share that instead.")
  } else {
    alert("A link to your stageplot has been copied the clipboard. The link itself includes the content for the page so be sure to click it again if you want to share any subsequent updates.");
  }
}

const getPageState = () => {
  const data = {
    name: document.getElementById("name").value,
    venue: document.getElementById("venue").value,
    date: document.getElementById("date").value,
    notes: document.getElementById("notes").value,
  };

  data['stage'] = canvas.toJSON();

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
