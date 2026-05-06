const express = require('express');
const { protect } = require('../middleware/auth');

const router = express.Router();

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
