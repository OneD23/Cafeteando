const express = require('express');
const { protect, restrictTo } = require('../middleware/auth');
const Sale = require('../models/Sale');
const CashSessionState = require('../models/CashSessionState');

const router = express.Router();

const getCashState = async () => {
  const existing = await CashSessionState.findOne({ key: 'default' });
  if (existing) return existing;
  return CashSessionState.create({ key: 'default' });
};

router.get('/cash-session', protect, async (req, res) => {
  const cashSession = await getCashState();
  res.json({ success: true, data: cashSession });
});

router.post('/cash-session/open', protect, async (req, res) => {
  const openingAmount = Number(req.body?.openingAmount || 0);
  const cashSession = await CashSessionState.findOneAndUpdate(
    { key: 'default' },
    {
      $set: {
        isOpen: true,
        openedAt: new Date(),
        openedBy: req.user?.id || req.user?._id,
        openingAmount,
      },
    },
    { upsert: true, new: true }
  );
  res.json({ success: true, message: 'Apertura registrada', data: cashSession });
});

router.post('/cash-session/close', protect, async (req, res) => {
  const cashSession = await CashSessionState.findOneAndUpdate(
    { key: 'default' },
    {
      $set: {
        isOpen: false,
        openedAt: null,
        openedBy: null,
        openingAmount: 0,
      },
    },
    { upsert: true, new: true }
  );
  res.json({ success: true, message: 'Cierre registrado', data: cashSession });
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
