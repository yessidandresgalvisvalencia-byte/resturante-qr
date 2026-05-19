const params = new URLSearchParams(window.location.search);

const restaurantId = params.get("restaurantId");


const form = document.getElementById("logoForm");

form.addEventListener("submit", async (e) => {

  e.preventDefault();

  const file = document.getElementById("logoInput").files[0];

  const formData = new FormData();

  formData.append("logo", file);

  const res = await fetch(
    `/api/restaurants/${restaurantId}/logo`,
    {
      method: "POST",
      body: formData
    }
  );

  const data = await res.json();

  if (data.ok) {

    document.getElementById("logoPreview").src =
      data.logoUrl;

    alert("Logo subido correctamente");

  } else {

    alert("Error subiendo logo");

  }

});