const loadData = () => {
  let state = null;
  const u = new URL(window.location.href);
  if (!u.searchParams.has("s")) {
      if (typeof localStorage["state"] !== "undefined") {
        state = JSON.parse(localStorage["state"]);
        console.log(`geting from localstorage: ${state}`);
      }
  } else {
    state = JSON.parse(atob(u.searchParams.get("s")));
    console.log(`geting from url: ${state}`);
  }
  
  window.history.replaceState('', 'Stageplot', 'http://localhost:9000');

  document.getElementById("name").value = state.name;
  document.getElementById("venue").value = state.venue;
  document.getElementById("date").value = state.date;
  document.getElementById("notes").value = state.notes;
  // document.getElementById("stage").innerHTML = state.stage;
  const inputs = state.inputs;
  const container = document.getElementById('inputs');
  const elems = container.getElementsByTagName('input');
  for (let i = 0; i < inputs.length; i++) {
      document.getElementById(inputs[i].id).value = inputs[i].value ?? '';
  }
}

const share = () => {
  const state = btoa(JSON.stringify(getPageState()));
  const url = "localhost:9000?s="+state;
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
