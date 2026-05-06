const express = require('express');
const { protect, restrictTo } = require('../middleware/auth');
const Sale = require('../models/Sale');

const router = express.Router();

let cashSession = {
  isOpen: false,
  openedAt: null,
  openedBy: null,
  openingAmount: 0,
};

router.get('/cash-session', protect, (req, res) => {
  res.json({ success: true, data: cashSession });
});

router.post('/cash-session/open', protect, (req, res) => {
  const openingAmount = Number(req.body?.openingAmount || 0);
  cashSession = {
    isOpen: true,
    openedAt: new Date().toISOString(),
    openedBy: req.user?.id || req.user?._id,
    openingAmount,
  };
  res.json({ success: true, message: 'Apertura registrada', data: cashSession });
});

router.post('/dgii/ecf/generate', protect, async (req, res) => {
  const { saleId, rnc, razonSocial, ncfType = 'B02' } = req.body || {};
  if (!saleId) return res.status(400).json({ success: false, message: 'saleId es requerido' });

  const sale = await Sale.findById(saleId);
  if (!sale) return res.status(404).json({ success: false, message: 'Venta no encontrada' });

  const ecf = {
    secuencia: `${ncfType}${Date.now().toString().slice(-8)}`,
    tipoComprobante: ncfType,
    rncComprador: rnc || null,
    razonSocialComprador: razonSocial || null,
    total: sale.total,
    fechaEmision: new Date().toISOString().slice(0, 10),
    estado: 'PENDIENTE_ENVIO_DGII',
  };

  res.json({
    success: true,
    message: 'e-CF generado (modo integración inicial)',
    data: ecf,
  });
});

router.post('/dgii/ecf/send', protect, restrictTo('admin', 'manager'), async (req, res) => {
  const { ecf } = req.body || {};
  if (!ecf?.secuencia) return res.status(400).json({ success: false, message: 'ecf.secuencia es requerido' });

  res.json({
    success: true,
    message: 'Integración DGII en modo sandbox/lista para proveedor certificador',
    data: {
      ...ecf,
      estado: 'ENVIADO_SIMULADO',
      trackId: `DGII-${Date.now()}`,
    },
  });
});

module.exports = router;
