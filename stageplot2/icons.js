function getIcons () {
  const icons = {
    "Guitar": () => {
      const i = new Image(18, 60)
      i.src = `icons/guitar.png`;
      return i;
    },
    "Banjo": () => {
      const i = new Image(18, 60)
      i.src = `icons/banjo.png`;
      return i;
    },
  };
}
  
export { getIcons }
