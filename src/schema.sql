CREATE TABLE `channel_reactions` (
  `id` int NOT NULL,
  `user_id` varchar(20) NOT NULL,
  `channel_id` varchar(20) NOT NULL,
  `reaction_count` int DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `polls` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) DEFAULT NULL,
  `type` enum('pups','pugs','pugs_trial') DEFAULT NULL,
  `upvotes` int DEFAULT '0',
  `downvotes` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `active` tinyint(1) DEFAULT '1',
  `message_id` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `removal_polls` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) NOT NULL,
  `initiator_id` varchar(255) NOT NULL,
  `reason` text NOT NULL,
  `status` varchar(10) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `vouch_message_id` varchar(255) DEFAULT NULL,
  `poll_type` enum('pups','pugs','premium') DEFAULT 'pups',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `removal_vouches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `poll_id` int DEFAULT NULL,
  `manager_id` varchar(255) NOT NULL,
  `reason` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `tickets` (
  `ticket_id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(20) NOT NULL,
  `channel_id` varchar(20) NOT NULL,
  `ticket_number` int NOT NULL,
  `status` enum('open','closed','claimed','deleted') NOT NULL DEFAULT 'open',
  `claimed_by` varchar(20) DEFAULT NULL,
  `ticket_message_id` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `transcript_url` varchar(255) DEFAULT NULL,
  `ticket_type` varchar(50) NOT NULL DEFAULT 'Support',
  `reported_user` varchar(255) DEFAULT NULL,
  `reason` text,
  `proof_urls` text,
  `invite_link` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ticket_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `ticket_settings` (
  `id` int NOT NULL,
  `ticket_counter` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `translation_blacklist` (
  `id` int NOT NULL,
  `user_id` varchar(20) NOT NULL,
  `message_id` varchar(20) NOT NULL,
  `channel_id` varchar(20) NOT NULL,
  `blacklist_reason` varchar(255) DEFAULT NULL,
  `issued_by` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `blacklist_timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `custom_duration` tinyint(1) DEFAULT '0',
  `notification_message_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `translation_reactions` (
  `id` int NOT NULL,
  `user_id` varchar(20) NOT NULL,
  `message_id` varchar(20) NOT NULL,
  `channel_id` varchar(20) NOT NULL,
  `reaction_timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `users` (
  `userID` varchar(255) NOT NULL,
  `strikes` int NOT NULL DEFAULT '0',
  `rankBanUntil` datetime DEFAULT NULL,
  PRIMARY KEY (`userID`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `votes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) DEFAULT NULL,
  `poll_user_id` varchar(255) DEFAULT NULL,
  `type` enum('pups','pugs') DEFAULT NULL,
  `vote` enum('upvote','downvote') DEFAULT NULL,
  `poll_id` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
