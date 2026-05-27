const AuditEvent = require('../models/AuditEvent');

exports.logAuditEvent = async ({ req, module, action, outcome = 'success', metadata = {} }) => {
  try {
    await AuditEvent.create({
      user: req.user?._id || null,
      action,
      module,
      outcome,
      requestId: req.requestId || 'n/a',
      metadata,
    });
  } catch (e) {
    // noop: nunca romper flujo principal por auditoría
  }
};
