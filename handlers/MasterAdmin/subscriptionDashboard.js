/**
 * Master Admin - Subscription Management Dashboard
 *
 * Comprehensive dashboard for managing company subscriptions,
 * tracking usage, and monitoring support tickets.
 */

const mongoose = require('mongoose');
const Company = require('../../models/company/company');
const SupportTicket = require('../../models/supportTicket/supportTicket');
const Branch = require('../../models/Branch/Branch');
const Order = require('../../models/oders/oders');
const { withLogger } = require('../../middleware/logger');
const { respond, extractAdminFromEvent } = require('../../utils/helpers');

/**
 * Get comprehensive subscription dashboard overview
 * GET /master-admin/subscription-dashboard
 */
module.exports.getSubscriptionDashboard = withLogger(async (event, context, logger) => {
  try {
    const admin = extractAdminFromEvent(event);

    // Parallel queries for performance
    const [
      totalCompanies,
      companiesByStatus,
      companiesByPlan,
      totalBranches,
      totalRevenue,
      supportTickets,
      expiringSubscriptions,
      trialCompanies,
      suspendedCompanies,
      recentCompanies,
    ] = await Promise.all([
      // Total companies
      Company.countDocuments(),

      // Companies by subscription status
      Company.aggregate([
        {
          $group: {
            _id: '$subscription.status',
            count: { $sum: 1 },
          },
        },
      ]),

      // Companies by plan
      Company.aggregate([
        {
          $group: {
            _id: '$subscription.plan',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$subscription.amount' },
          },
        },
      ]),

      // Total branches across all companies
      Branch.countDocuments(),

      // Total revenue (active subscriptions)
      Company.aggregate([
        {
          $match: {
            'subscription.status': 'active',
          },
        },
        {
          $group: {
            _id: null,
            monthlyRevenue: {
              $sum: {
                $cond: [
                  { $eq: ['$subscription.billingCycle', 'monthly'] },
                  '$subscription.amount',
                  { $divide: ['$subscription.amount', 12] },
                ],
              },
            },
            yearlyRevenue: {
              $sum: {
                $cond: [
                  { $eq: ['$subscription.billingCycle', 'yearly'] },
                  '$subscription.amount',
                  { $multiply: ['$subscription.amount', 12] },
                ],
              },
            },
          },
        },
      ]),

      // Support ticket statistics
      SupportTicket.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),

      // Expiring subscriptions (next 30 days)
      Company.find({
        'subscription.status': 'active',
        'subscription.endDate': {
          $gte: new Date(),
          $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
        .select('companyName email subscription')
        .lean(),

      // Companies in trial
      Company.find({
        'subscription.plan': 'trial',
        'subscription.status': { $in: ['active', 'pending'] },
      })
        .select('companyName email subscription.trialEndDate')
        .lean(),

      // Suspended companies
      Company.find({
        'subscription.status': 'suspended',
      })
        .select('companyName email subscription')
        .lean(),

      // Recently created companies (last 7 days)
      Company.find({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      })
        .select('companyName email subscription createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    // Format status breakdown
    const statusBreakdown = {
      active: 0,
      pending: 0,
      suspended: 0,
      cancelled: 0,
      expired: 0,
    };

    companiesByStatus.forEach((item) => {
      statusBreakdown[item._id] = item.count;
    });

    // Format plan breakdown
    const planBreakdown = {
      trial: { count: 0, revenue: 0 },
      basic: { count: 0, revenue: 0 },
      professional: { count: 0, revenue: 0 },
      enterprise: { count: 0, revenue: 0 },
      custom: { count: 0, revenue: 0 },
    };

    companiesByPlan.forEach((item) => {
      planBreakdown[item._id] = {
        count: item.count,
        revenue: item.totalRevenue || 0,
      };
    });

    // Format support ticket stats
    const supportStats = {
      open: 0,
      in_progress: 0,
      pending_customer: 0,
      resolved: 0,
      closed: 0,
      total: 0,
    };

    supportTickets.forEach((item) => {
      supportStats[item._id] = item.count;
      supportStats.total += item.count;
    });

    // Calculate revenue metrics
    const revenueMetrics =
      totalRevenue.length > 0
        ? {
            monthlyRecurring: totalRevenue[0].monthlyRevenue || 0,
            annualRecurring: totalRevenue[0].yearlyRevenue || 0,
            totalAnnual:
              (totalRevenue[0].monthlyRevenue || 0) + (totalRevenue[0].yearlyRevenue || 0),
          }
        : {
            monthlyRecurring: 0,
            annualRecurring: 0,
            totalAnnual: 0,
          };

    logger.info('Subscription dashboard generated', {
      totalCompanies,
      activeCompanies: statusBreakdown.active,
    });

    return respond(200, {
      summary: {
        totalCompanies,
        totalBranches,
        statusBreakdown,
        planBreakdown,
        revenue: revenueMetrics,
        supportTickets: supportStats,
      },
      alerts: {
        expiringSubscriptions: expiringSubscriptions.length,
        trialCompanies: trialCompanies.length,
        suspendedCompanies: suspendedCompanies.length,
      },
      expiringSubscriptions,
      trialCompanies,
      suspendedCompanies,
      recentCompanies,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting subscription dashboard', { error: error.message });
    return respond(500, { message: 'Failed to get subscription dashboard', error: error.message });
  }
});

/**
 * Get all companies with filters
 * GET /master-admin/companies?page=1&limit=50&status=active&plan=professional&search=company
 */
module.exports.getAllCompanies = withLogger(async (event, context, logger) => {
  try {
    const admin = extractAdminFromEvent(event);
    const params = event.queryStringParameters || {};

    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 50;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};

    if (params.status) {
      filter['subscription.status'] = params.status;
    }

    if (params.plan) {
      filter['subscription.plan'] = params.plan;
    }

    if (params.isActive !== undefined) {
      filter.isActive = params.isActive === 'true';
    }

    if (params.search) {
      filter.$or = [
        { companyName: { $regex: params.search, $options: 'i' } },
        { companyCode: { $regex: params.search, $options: 'i' } },
        { email: { $regex: params.search, $options: 'i' } },
      ];
    }

    const [companies, total] = await Promise.all([
      Company.find(filter)
        .select('-notes')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Company.countDocuments(filter),
    ]);

    logger.info('Companies retrieved', { total, page, limit });

    return respond(200, {
      companies,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error getting companies', { error: error.message });
    return respond(500, { message: 'Failed to get companies', error: error.message });
  }
});

/**
 * Get company by ID with detailed information
 * GET /master-admin/companies/{id}
 */
module.exports.getCompanyById = withLogger(async (event, context, logger) => {
  try {
    const admin = extractAdminFromEvent(event);
    const companyId = event.pathParameters.id;

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return respond(400, { message: 'Invalid company ID' });
    }

    const [company, branches, orders, supportTickets] = await Promise.all([
      Company.findById(companyId).lean(),
      Branch.find({ companyId }).select('branchName location isActive').lean(),
      Order.aggregate([
        { $match: { companyId: mongoose.Types.ObjectId(companyId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      SupportTicket.find({ companyId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('ticketNumber subject status priority createdAt')
        .lean(),
    ]);

    if (!company) {
      return respond(404, { message: 'Company not found' });
    }

    // Format order stats
    const orderStats = {
      total: 0,
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };

    orders.forEach((item) => {
      orderStats[item._id] = item.count;
      orderStats.total += item.count;
    });

    logger.info('Company details retrieved', { companyId });

    return respond(200, {
      company,
      branches: {
        total: branches.length,
        active: branches.filter((b) => b.isActive).length,
        list: branches,
      },
      orders: orderStats,
      supportTickets: {
        total: supportTickets.length,
        recent: supportTickets,
      },
    });
  } catch (error) {
    logger.error('Error getting company', { error: error.message });
    return respond(500, { message: 'Failed to get company', error: error.message });
  }
});

/**
 * Create new company
 * POST /master-admin/companies
 */
module.exports.createCompany = withLogger(async (event, context, logger) => {
  try {
    const admin = extractAdminFromEvent(event);
    const data = JSON.parse(event.body);

    // Generate company code if not provided
    if (!data.companyCode) {
      data.companyCode = await Company.generateCompanyCode(data.companyName);
    }

    // Set trial defaults if not provided
    if (!data.subscription) {
      data.subscription = {
        plan: 'trial',
        status: 'active',
        startDate: new Date(),
        trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      };
    }

    // Set created by
    data.createdBy = admin.id;

    const company = new Company(data);
    await company.save();

    logger.info('Company created', { companyId: company._id, companyName: company.companyName });

    return respond(201, {
      message: 'Company created successfully',
      company,
    });
  } catch (error) {
    logger.error('Error creating company', { error: error.message });

    if (error.code === 11000) {
      return respond(400, { message: 'Company code or email already exists' });
    }

    return respond(500, { message: 'Failed to create company', error: error.message });
  }
});

/**
 * Update company
 * PUT /master-admin/companies/{id}
 */
module.exports.updateCompany = withLogger(async (event, context, logger) => {
  try {
    const admin = extractAdminFromEvent(event);
    const companyId = event.pathParameters.id;
    const updates = JSON.parse(event.body);

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return respond(400, { message: 'Invalid company ID' });
    }

    // Add last modified by
    updates.lastModifiedBy = admin.id;

    const company = await Company.findByIdAndUpdate(companyId, updates, {
      new: true,
      runValidators: true,
    });

    if (!company) {
      return respond(404, { message: 'Company not found' });
    }

    logger.info('Company updated', { companyId, updates: Object.keys(updates) });

    return respond(200, {
      message: 'Company updated successfully',
      company,
    });
  } catch (error) {
    logger.error('Error updating company', { error: error.message });
    return respond(500, { message: 'Failed to update company', error: error.message });
  }
});

/**
 * Get companies with pending subscriptions
 * GET /master-admin/subscription/pending
 */
module.exports.getPendingSubscriptions = withLogger(async (event, context, logger) => {
  try {
    const admin = extractAdminFromEvent(event);

    const companies = await Company.find({
      'subscription.status': 'pending',
    })
      .select('companyName email phone subscription primaryContact createdAt')
      .sort({ createdAt: -1 })
      .lean();

    logger.info('Pending subscriptions retrieved', { count: companies.length });

    return respond(200, {
      companies,
      total: companies.length,
    });
  } catch (error) {
    logger.error('Error getting pending subscriptions', { error: error.message });
    return respond(500, {
      message: 'Failed to get pending subscriptions',
      error: error.message,
    });
  }
});

/**
 * Get companies with expiring subscriptions (next 30 days)
 * GET /master-admin/subscription/expiring?days=30
 */
module.exports.getExpiringSubscriptions = withLogger(async (event, context, logger) => {
  try {
    const admin = extractAdminFromEvent(event);
    const params = event.queryStringParameters || {};
    const days = parseInt(params.days) || 30;

    const companies = await Company.find({
      'subscription.status': 'active',
      'subscription.endDate': {
        $gte: new Date(),
        $lte: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    })
      .select('companyName email subscription primaryContact')
      .sort({ 'subscription.endDate': 1 })
      .lean();

    logger.info('Expiring subscriptions retrieved', { count: companies.length, days });

    return respond(200, {
      companies,
      total: companies.length,
      daysAhead: days,
    });
  } catch (error) {
    logger.error('Error getting expiring subscriptions', { error: error.message });
    return respond(500, {
      message: 'Failed to get expiring subscriptions',
      error: error.message,
    });
  }
});

/**
 * Get support ticket statistics and recent tickets
 * GET /master-admin/support-stats?days=30&page=1&limit=50
 */
module.exports.getSupportStats = withLogger(async (event, context, logger) => {
  try {
    const admin = extractAdminFromEvent(event);
    const params = event.queryStringParameters || {};

    const days = parseInt(params.days) || 30;
    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 50;
    const skip = (page - 1) * limit;

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [statusStats, priorityStats, categoryStats, recentTickets, totalTickets] =
      await Promise.all([
        // Tickets by status
        SupportTicket.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ]),

        // Tickets by priority
        SupportTicket.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: '$priority',
              count: { $sum: 1 },
            },
          },
        ]),

        // Tickets by category
        SupportTicket.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 },
            },
          },
        ]),

        // Recent tickets with company info
        SupportTicket.find({ createdAt: { $gte: startDate } })
          .populate('companyId', 'companyName email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        // Total count
        SupportTicket.countDocuments({ createdAt: { $gte: startDate } }),
      ]);

    // Format statistics
    const stats = {
      byStatus: {},
      byPriority: {},
      byCategory: {},
      total: totalTickets,
    };

    statusStats.forEach((item) => {
      stats.byStatus[item._id] = item.count;
    });

    priorityStats.forEach((item) => {
      stats.byPriority[item._id] = item.count;
    });

    categoryStats.forEach((item) => {
      stats.byCategory[item._id] = item.count;
    });

    logger.info('Support stats retrieved', { total: totalTickets, days });

    return respond(200, {
      stats,
      recentTickets,
      pagination: {
        page,
        limit,
        total: totalTickets,
        pages: Math.ceil(totalTickets / limit),
      },
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting support stats', { error: error.message });
    return respond(500, { message: 'Failed to get support stats', error: error.message });
  }
});

/**
 * Get revenue analytics
 * GET /master-admin/revenue-analytics?months=12
 */
module.exports.getRevenueAnalytics = withLogger(async (event, context, logger) => {
  try {
    const admin = extractAdminFromEvent(event);
    const params = event.queryStringParameters || {};
    const months = parseInt(params.months) || 12;

    const [currentRevenue, historicalRevenue, revenueByPlan] = await Promise.all([
      // Current MRR and ARR
      Company.aggregate([
        { $match: { 'subscription.status': 'active' } },
        {
          $group: {
            _id: null,
            mrr: {
              $sum: {
                $cond: [
                  { $eq: ['$subscription.billingCycle', 'monthly'] },
                  '$subscription.amount',
                  { $divide: ['$subscription.amount', 12] },
                ],
              },
            },
            arr: {
              $sum: {
                $cond: [
                  { $eq: ['$subscription.billingCycle', 'yearly'] },
                  '$subscription.amount',
                  { $multiply: ['$subscription.amount', 12] },
                ],
              },
            },
          },
        },
      ]),

      // Historical revenue by month
      Company.aggregate([
        {
          $match: {
            'subscription.status': { $in: ['active', 'cancelled', 'expired'] },
            'subscription.startDate': {
              $gte: new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$subscription.startDate' },
              month: { $month: '$subscription.startDate' },
            },
            revenue: { $sum: '$subscription.amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),

      // Revenue by plan
      Company.aggregate([
        { $match: { 'subscription.status': 'active' } },
        {
          $group: {
            _id: '$subscription.plan',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$subscription.amount' },
            avgRevenue: { $avg: '$subscription.amount' },
          },
        },
      ]),
    ]);

    const metrics =
      currentRevenue.length > 0
        ? {
            mrr: currentRevenue[0].mrr || 0,
            arr: currentRevenue[0].arr || 0,
            totalRecurring: (currentRevenue[0].mrr || 0) + (currentRevenue[0].arr || 0),
          }
        : { mrr: 0, arr: 0, totalRecurring: 0 };

    logger.info('Revenue analytics retrieved', { months });

    return respond(200, {
      current: metrics,
      historical: historicalRevenue,
      byPlan: revenueByPlan,
      period: {
        months,
        startDate: new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting revenue analytics', { error: error.message });
    return respond(500, { message: 'Failed to get revenue analytics', error: error.message });
  }
});
