const ctx = document.getElementById("graficaProductos");

new Chart(ctx, {
  type: "bar",
  data: {
    labels: ["Hamburguesa", "Pizza", "Perro", "Gaseosa"],
    datasets: [{
      label: "Ventas",
      data: [120, 90, 70, 150]
    }]
  }
});