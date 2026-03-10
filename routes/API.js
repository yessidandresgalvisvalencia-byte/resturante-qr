const express = require("express")
const QRCode = require("qrcode")
const router = express.Router()

const Pedido = require("../models/pedido.js"); 
const Llamado = require("../models/llamado")

function menuBase() {
    return [
        {
            id: 1,
            nombre: "Hamburguesa clásica",
            categoria: "Hamburguesas",
            precio: 20000,
            imagen: "/img/hamburguesa.jpg",
            disponible: true,
            tiempoBase: 15
        },
        {
            id: 2,
            nombre: "Pizza personal",
            categoria: "Pizzas",
            precio: 30000,
            imagen: "/img/pizza.jpg",
            disponible: true,
            tiempoBase: 20
        },
        {
            id: 3,
            nombre: "Gaseosa",
            categoria: "Bebidas",
            precio: 5000,
            imagen: "/img/gaseosa.jpg",
            disponible: true,
            tiempoBase: 2
        },
        {
            id: 4,
            nombre: "Perro caliente",
            categoria: "Comida rápida",
            precio: 18000,
            imagen: "/img/perro.jpg",
            disponible: true,
            tiempoBase: 12
        },
        {
            id: 5,
            nombre: "Papas especiales",
            categoria: "Acompañamientos",
            precio: 12000,
            imagen: "/img/papas.jpg",
            disponible: true,
            tiempoBase: 10
        },
        {
            id: 6,
            nombre: "Helado",
            categoria: "Postres",
            precio: 9000,
            imagen: "/img/helado.jpg",
            disponible: true,
            tiempoBase: 3
        }
    ]
}

const menusPorRestaurante = {
    rest1: menuBase()
}

function getRestaurantId(req) {
    return req.query.restaurantId || req.body.restaurantId || "rest1"
}

function getMenu(restaurantId) {
    if (!menusPorRestaurante[restaurantId]) {
        menusPorRestaurante[restaurantId] = menuBase()
    }
    return menusPorRestaurante[restaurantId]
}

router.get("/menu", (req, res) => {
    const restaurantId = getRestaurantId(req)
    const menu = getMenu(restaurantId)
    res.json(menu)
})

router.put("/menu/:id/stock", (req, res) => {
    const restaurantId = getRestaurantId(req)
    const menu = getMenu(restaurantId)
    const id = Number(req.params.id)

    const producto = menu.find(item => item.id === id)
    if (!producto) {
        return res.status(404).json({ mensaje: "Producto no encontrado" })
    }

    producto.disponible = Boolean(req.body.disponible)

    const io = req.app.get("io")
    io.emit("menu:actualizado", { restaurantId })

    res.json(producto)
})

router.post("/pedido", async (req, res) => {
    try {
        const restaurantId = getRestaurantId(req)
        const { mesa, producto, categoria, precio, metodoPago, tiempoEstimado } = req.body

        if (!mesa || !producto || !precio) {
            return res.status(400).json({ mensaje: "Faltan datos del pedido" })
        }

        const pedido = new Pedido({
            restaurantId,
            mesa: Number(mesa),
            producto,
            categoria: categoria || "",
            precio: Number(precio),
            metodoPago: metodoPago || "efectivo",
            estado: "pedido",
            estadoPago: "pendiente",
            tiempoEstimado: Number(tiempoEstimado || 15)
        })

        await pedido.save()

        const io = req.app.get("io")
        io.emit("pedido:nuevo", pedido)

        res.json(pedido)
    } catch (error) {
        res.status(500).json({ mensaje: "Error creando pedido", error })
    }
})

router.get("/pedidos", async (req, res) => {
    try {
        const restaurantId = getRestaurantId(req)
        const pedidos = await Pedido.find({ restaurantId }).sort({ createdAt: -1 })
        res.json(pedidos)
    } catch (error) {
        res.status(500).json({ mensaje: "Error obteniendo pedidos", error })
    }
})

router.get("/pedidos/mesa/:mesa", async (req, res) => {
    try {
        const restaurantId = getRestaurantId(req)
        const mesa = Number(req.params.mesa)

        const pedidos = await Pedido.find({ restaurantId, mesa }).sort({ createdAt: -1 })

        const subtotal = pedidos
            .filter(p => p.estado !== "entregado")
            .reduce((acc, p) => acc + p.precio, 0)

        res.json({ pedidos, subtotal })
    } catch (error) {
        res.status(500).json({ mensaje: "Error obteniendo pedidos por mesa", error })
    }
})

router.put("/pedido/:id/estado", async (req, res) => {
    try {
        const { estado, tiempoEstimado } = req.body

        const update = { estado }
        if (tiempoEstimado) {
            update.tiempoEstimado = Number(tiempoEstimado)
        }

        const pedido = await Pedido.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true }
        )

        const io = req.app.get("io")
        io.emit("pedido:actualizado", pedido)

        res.json(pedido)
    } catch (error) {
        res.status(500).json({ mensaje: "Error actualizando pedido", error })
    }
})

router.put("/pedido/:id/pago", async (req, res) => {
    try {
        const { estadoPago } = req.body

        const pedido = await Pedido.findByIdAndUpdate(
            req.params.id,
            { estadoPago },
            { new: true }
        )

        const io = req.app.get("io")
        io.emit("pedido:actualizado", pedido)

        res.json(pedido)
    } catch (error) {
        res.status(500).json({ mensaje: "Error actualizando pago", error })
    }
})

router.post("/llamar-mesero", async (req, res) => {
    try {
        const restaurantId = getRestaurantId(req)
        const { mesa, mensaje } = req.body

        const llamado = new Llamado({
            restaurantId,
            mesa: Number(mesa),
            mensaje: mensaje || "Mesa necesita atención"
        })

        await llamado.save()

        const io = req.app.get("io")
        io.emit("llamado:nuevo", llamado)

        res.json(llamado)
    } catch (error) {
        res.status(500).json({ mensaje: "Error creando llamado", error })
    }
})

router.get("/llamados", async (req, res) => {
    try {
        const restaurantId = getRestaurantId(req)
        const llamados = await Llamado.find({ restaurantId }).sort({ createdAt: -1 })
        res.json(llamados)
    } catch (error) {
        res.status(500).json({ mensaje: "Error obteniendo llamados", error })
    }
})

router.put("/llamados/:id/atender", async (req, res) => {
    try {
        const llamado = await Llamado.findByIdAndUpdate(
            req.params.id,
            { estado: "atendido" },
            { new: true }
        )

        const io = req.app.get("io")
        io.emit("llamado:actualizado", llamado)

        res.json(llamado)
    } catch (error) {
        res.status(500).json({ mensaje: "Error atendiendo llamado", error })
    }
})

router.get("/admin/resumen", async (req, res) => {
    try {
        const restaurantId = getRestaurantId(req)

        const pedidos = await Pedido.find({ restaurantId }).sort({ createdAt: -1 })
        const activos = pedidos.filter(p => p.estado !== "entregado")
        const totalVendido = pedidos.reduce((acc, p) => acc + p.precio, 0)

        const topMap = {}
        pedidos.forEach(p => {
            if (!topMap[p.producto]) topMap[p.producto] = 0
            topMap[p.producto] += 1
        })

        const topProductos = Object.entries(topMap)
            .map(([producto, cantidad]) => ({ producto, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 5)

        const historial = pedidos.slice(0, 20)

        res.json({
            totalVendido,
            pedidosActivos: activos.length,
            topProductos,
            historial
        })
    } catch (error) {
        res.status(500).json({ mensaje: "Error resumen admin", error })
    }
})

router.get("/factura/mesa/:mesa", async (req, res) => {
    try {
        const restaurantId = getRestaurantId(req)
        const mesa = Number(req.params.mesa)
        const propina = Number(req.query.propina || 0)

        const pedidos = await Pedido.find({ restaurantId, mesa }).sort({ createdAt: -1 })

        const subtotal = pedidos
            .filter(p => p.estado !== "entregado")
            .reduce((acc, p) => acc + p.precio, 0)

        const valorPropina = Math.round(subtotal * (propina / 100))
        const total = subtotal + valorPropina

        res.json({
            mesa,
            pedidos,
            subtotal,
            propina,
            valorPropina,
            total
        })
    } catch (error) {
        res.status(500).json({ mensaje: "Error generando factura", error })
    }
})

router.get("/qr/:mesa", async (req, res) => {
    try {
        const restaurantId = getRestaurantId(req)
        const mesa = Number(req.params.mesa)
        const baseUrl = req.query.baseUrl || `${req.protocol}://${req.get("host")}`
        const url = `${baseUrl}/?restaurantId=${restaurantId}&mesa=${mesa}`

        const dataUrl = await QRCode.toDataURL(url)

        res.json({
            mesa,
            restaurantId,
            url,
            dataUrl
        })
    } catch (error) {
        res.status(500).json({ mensaje: "Error generando QR", error })
    }
})

module.exports = router