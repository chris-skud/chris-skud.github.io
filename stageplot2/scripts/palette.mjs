
function render() {
  // canvas = document.getElementById('c'),
  // context = canvas.getContext('2d');
  const icons = {
      "Guitar": () => { 
          const i = new Image();
          i.id = 'guitar';
          
          // i.addEventListener("onclick", addImageToStage);
          i.src = `icons/guitar.png`;
          // i.onclick = addImageToStage;
          // i.draggable = true;
          // i.addEventListener("dragstart", dragstart_handler);
          
          return i; 
      },
      "Banjo": () => { const i = new Image(); i.src = `icons/banjo.png`; return i;},
      "Barstool": () => { const i = new Image(); i.src = `icons/barstool.png`; return i;},
      "Electric Bass": () => { const i = new Image(); i.src = `icons/bassElectric.png`; return i;},
      "Upright Bass": () => { const i = new Image(); i.src = `icons/bassUpright.png`; return i;},
      "Bass Cabinet Eight": () => { const i = new Image(); i.src = `icons/cabinetBassEightTen.png`; return i;},
      "Bass Cabinet Six": () => { const i = new Image(); i.src = `icons/cabinetBassSixTen.png`; return i;},
      "Bass Combo": () => { const i = new Image(); i.src = `icons/comboBass.png`; return i;},
      "Guitar Combo": () => { const i = new Image(); i.src = `icons/comboGuitar.png`; return i;},
      "Drums Four Piece": () => { const i = new Image(); i.src = `icons/drumsFour.png`; return i;},
      "Drums Six Piece": () => { const i = new Image(); i.src = `icons/drumsSix.png`; return i;},
      "Power": () => { const i = new Image(); i.src = `icons/electric.png`; return i;},
      "Acoustic Guitar": () => { const i = new Image(); i.src = `icons/guitarAcoustic.png`; return i;},
      "Keyboard": () => { const i = new Image(); i.src = `icons/keyboard.png`; return i;},
      "Keytar": () => { const i = new Image(); i.src = `icons/keytar.png`; return i;},
      "Laptop": () => { const i = new Image(); i.src = `icons/laptop.png`; return i;},
      "Mandolin": () => { const i = new Image(); i.src = `icons/mandolin.png`; return i;},
      "Monitor": () => { const i = new Image(); i.src = `icons/monitorTop.png`; return i;},
      "Wedge": () => { const i = new Image(); i.src = `icons/monitorWedge.png`; return i;},
      "Grand Piano": () => { const i = new Image(); i.src = `icons/pianoGrand.png`; return i;},
      "Upright Piano": () => { const i = new Image(); i.src = `icons/pianoUpright.png`; return i;},
      "Full Stack": () => { const i = new Image(); i.src = `icons/stackFull.png`; return i;},
      "Half Stack": () => { const i = new Image(); i.src = `icons/stackHalf.png`; return i;},
      "Boom Stand": () => { const i = new Image(); i.src = `icons/standMicBoom.png`; return i;},
      "Mic Stand": () => { const i = new Image(); i.src = `icons/standMicStraight.png`; return i;},
      "Violin": () => { const i = new Image(); i.src = `icons/violin.png`; return i;},
  };
  for (const key in icons) {
      document.getElementById("palette").appendChild(icons[key]())    
  }
}

export {render};