const body = {
  videoURL: "https://github.com/darks0l/autoresearch/releases/download/v1.0.0-demo/autoresearch-demo.mp4"
};

fetch("https://synthesis.devfolio.co/projects/644a0b1b356d40be821b898bf0c4db1d", {
  method: "POST",
  headers: {
    "Authorization": "Bearer REDACTED",
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
}).then(r => r.json()).then(d => {
  if (d.success === false) console.log("Error:", JSON.stringify(d.error).slice(0,300));
  else console.log("Video URL updated. Status:", d.status);
}).catch(e => console.error(e));
