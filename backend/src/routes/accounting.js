const express = require('express');
const AccountingEntry = require('../models/AccountingEntry');
const Sale = require('../models/Sale');
const { protect } = require('../middleware/auth');

const router = express.Router();

const toDayKey = (d) => new Date(d).toISOString().slice(0, 10);

router.post('/entries', protect, async (req, res) => {
  try {
    const { direction, category, description, amount, date, reference } = req.body;
    if (!direction || !category || !description || !amount) {
      return res.status(400).json({ success: false, message: 'direction, category, description y amount son obligatorios' });
    }
    const dt = date ? new Date(date) : new Date();
    const entry = await AccountingEntry.create({
      direction,
      category,
      description,
      amount: Number(amount),
      date: dt,
      dayKey: toDayKey(dt),
      reference,
      sourceType: 'manual',
      user: req.user._id,
    });
    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/entries', protect, async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 50, category } = req.query;
    const query = {};
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (category) query.category = category;

    const rows = await AccountingEntry.find(query)
      .sort({ date: -1, createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    const count = await AccountingEntry.countDocuments(query);

    res.json({ success: true, count, page: Number(page), pages: Math.ceil(count / Number(limit)), data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/daily-journal', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = {};
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate);
    }

    const grouped = await AccountingEntry.aggregate([
      { $match: match },
      { $group: {
        _id: '$dayKey',
        entries: { $sum: { $cond: [{ $eq: ['$direction', 'in'] }, '$amount', 0] } },
        exits: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, '$amount', 0] } },
        count: { $sum: 1 },
      }},
      { $project: { day: '$_id', entries: 1, exits: 1, result: { $subtract: ['$entries', '$exits'] }, count: 1, _id: 0 } },
      { $sort: { day: -1 } },
    ]);

    res.json({ success: true, data: grouped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/invoices', protect, async (req, res) => {
  try {
    const { startDate, endDate, text, page = 1, limit = 30 } = req.query;
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (text) {
      query.$or = [
        { saleId: { $regex: String(text), $options: 'i' } },
        { 'customer.name': { $regex: String(text), $options: 'i' } },
      ];
    }

    const rows = await Sale.find(query)
      .populate('cashier', 'name')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    const count = await Sale.countDocuments(query);

    res.json({ success: true, count, page: Number(page), pages: Math.ceil(count / Number(limit)), data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
