const express = require('express');
const { protect } = require('../middleware/auth');
const Client = require('../models/Client');

const router = express.Router();


const normalizeClientPayload = (payload) => ({
  externalId: payload.externalId || payload.id,
  name: payload.name,
  phone: payload.phone,
  email: payload.email,
  taxId: payload.taxId,
  address: payload.address,
  creditLimit: Number(payload.creditLimit || 0),
  creditActive: payload.creditActive === true || payload.creditActive === 'true' || payload.creditActive === '1',
  isActive: payload.isActive !== false,
  syncId: payload.syncId,
  lastModified: new Date()
});

router.get('/', protect, async (req, res) => {
  try {
    const clients = await Client.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, count: clients.length, data: clients });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    if (!req.body?.name) {
      return res.status(400).json({ success: false, message: 'El nombre del cliente es obligatorio' });
    }

    const payload = normalizeClientPayload(req.body);
    const query = payload.externalId ? { externalId: payload.externalId } : { name: payload.name, phone: payload.phone || '' };
    const client = await Client.findOneAndUpdate(query, payload, { new: true, upsert: true, runValidators: true });

    res.status(201).json({ success: true, data: client });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const payload = normalizeClientPayload(req.body);
    const client = await Client.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });

    if (!client) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }

    res.json({ success: true, data: client });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/promotions/send', protect, async (req, res) => {
  try {
    const { client, message } = req.body;

    if (!client?.name || !message) {
      return res.status(400).json({
        success: false,
        message: 'client.name y message son obligatorios',
      });
    }

    const renderedMessage = String(message).replace('{cliente}', client.name);
    const encodedMessage = encodeURIComponent(renderedMessage);

    const normalizedPhone = String(client.phone || '').replace(/[^0-9]/g, '');
    const whatsappUrl = normalizedPhone
      ? `https://wa.me/${normalizedPhone}?text=${encodedMessage}`
      : null;

    const subject = encodeURIComponent('Promoción CafeTrack');
    const emailUrl = client.email
      ? `mailto:${client.email}?subject=${subject}&body=${encodedMessage}`
      : null;

    return res.json({
      success: true,
      message: 'Promoción preparada correctamente',
      data: {
        renderedMessage,
        whatsappUrl,
        emailUrl,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
