// handlers/buttonHandlersRegistry.js

const handleUnblacklistButton = require('./handleUnblacklistButton');
const { handlePremiumPagination } = require('./premiumPaginationHandler');
const { handleCreateTicketButton } = require('./tickets/handleCreateTicketButton');
const handleCloseTicketButton = require('./tickets/handleCloseTicketButton');
const handleClaimTicketButton = require('./tickets/handleClaimTicketButton');
const handleDeleteTicketButton = require('./tickets/handleDeleteTicketButton');
const handleReopenTicketButton = require('./tickets/handleReopenTicketButton');
const handleEvidenceButton = require('./tickets/handleEvidenceButton');
const handlePartnershipDetailsButton = require('./tickets/handlePartnershipDetailsButton');
const handleReportDetailsButton = require('./tickets/handleReportDetailsButton');
const handleShowTicketModal = require('./tickets/handleShowTicketModal');
const pupsVoteHandler = require('./voting/pupsVoteHandler');
const pugsVoteHandler = require('./voting/pugsVoteHandler');
const { handlePagination: handleStaffPagination } = require('./staffListHandler');

const buttonHandlers = {
    // Existing Handlers
    'unblacklist': handleUnblacklistButton,
    'prev_premium': handlePremiumPagination,
    'next_premium': handlePremiumPagination,
    'create_general': handleCreateTicketButton,
    'create_appeal': handleCreateTicketButton,
    'create_store': handleCreateTicketButton,
    'create_staff_report': handleCreateTicketButton,
    'create_partnership': handleCreateTicketButton,
    'close_ticket': handleCloseTicketButton,
    'claim_ticket': handleClaimTicketButton,
    'delete_ticket': handleDeleteTicketButton,
    'reopen_ticket': handleReopenTicketButton,
    'evidence': handleEvidenceButton, // Prefix 'evidence_'
    'partnership_details': handlePartnershipDetailsButton, // Prefix 'partnership_details_'
    'report_details': handleReportDetailsButton, // Prefix 'report_details_'
    'modal': handleShowTicketModal,
    
    // PUPS vote handlers
    'upvote_pups': pupsVoteHandler.handleUpvote,
    'downvote_pups': pupsVoteHandler.handleDownvote,
    'end_vote_pups': pupsVoteHandler.handleEndVote,
    'add_to_pups': pupsVoteHandler.handleAddToPupsButton, // Corrected from handleAddToPups
    'next_list_pups': pupsVoteHandler.handlePagination,
    'prev_list_pups': pupsVoteHandler.handlePagination,

    // PUGs Handlers
    'upvote_pugs': pugsVoteHandler.handleUpvote,
    'downvote_pugs': pugsVoteHandler.handleDownvote,
    'end_vote_pugs': pugsVoteHandler.handleEndVote,
    'add_to_pugs': pugsVoteHandler.handleAddToPugs,
    'remove_pugs': pugsVoteHandler.handleRemovePugs,
    'undo_pugs': pugsVoteHandler.handleUndoPugs,
    'vouch_pugs': pugsVoteHandler.handleVouchPugs,
    
    // Staff list handlers
    'stafflist_prev': handleStaffPagination,
    'stafflist_next': handleStaffPagination,
};

module.exports = buttonHandlers;
