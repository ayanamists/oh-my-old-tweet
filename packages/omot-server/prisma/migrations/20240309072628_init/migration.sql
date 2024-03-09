-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `originalId` VARCHAR(191) NOT NULL,
    `joinTime` TIMESTAMP(6) NULL,
    `leaveTime` TIMESTAMP(6) NULL,
    `lastModified` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `User_originalId_key`(`originalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserName` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fullName` VARCHAR(191) NOT NULL,
    `userName` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserAvatar` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `imgId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bgImgId` INTEGER NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `postId` INTEGER NOT NULL,

    UNIQUE INDEX `UserProfile_postId_key`(`postId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Post` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `originalId` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `userNameId` INTEGER NOT NULL,
    `userAvatarId` INTEGER NULL,
    `content` TEXT NOT NULL,
    `date` TIMESTAMP(6) NOT NULL,
    `tweetUrl` VARCHAR(191) NOT NULL,
    `archiveUrl` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL,
    `repliesToOriginalId` VARCHAR(191) NULL,
    `repliesToUserName` VARCHAR(191) NULL,
    `lastModified` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `Post_originalId_key`(`originalId`),
    UNIQUE INDEX `Post_userNameId_key`(`userNameId`),
    UNIQUE INDEX `Post_userAvatarId_key`(`userAvatarId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Engagement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `likes` INTEGER NOT NULL DEFAULT 0,
    `retweets` INTEGER NOT NULL DEFAULT 0,
    `postId` INTEGER NOT NULL,

    UNIQUE INDEX `Engagement_postId_key`(`postId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Image` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `originUrl` VARCHAR(191) NOT NULL,
    `dir` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,

    UNIQUE INDEX `Image_originUrl_key`(`originUrl`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Video` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `originUrl` VARCHAR(191) NOT NULL,
    `dir` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `postId` INTEGER NOT NULL,

    UNIQUE INDEX `Video_originUrl_key`(`originUrl`),
    UNIQUE INDEX `Video_postId_key`(`postId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_UserFollows` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_UserFollows_AB_unique`(`A`, `B`),
    INDEX `_UserFollows_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_PostImages` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_PostImages_AB_unique`(`A`, `B`),
    INDEX `_PostImages_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserAvatar` ADD CONSTRAINT `UserAvatar_imgId_fkey` FOREIGN KEY (`imgId`) REFERENCES `Image`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserProfile` ADD CONSTRAINT `UserProfile_bgImgId_fkey` FOREIGN KEY (`bgImgId`) REFERENCES `Image`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserProfile` ADD CONSTRAINT `UserProfile_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_userNameId_fkey` FOREIGN KEY (`userNameId`) REFERENCES `UserName`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_userAvatarId_fkey` FOREIGN KEY (`userAvatarId`) REFERENCES `UserAvatar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Engagement` ADD CONSTRAINT `Engagement_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Video` ADD CONSTRAINT `Video_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_UserFollows` ADD CONSTRAINT `_UserFollows_A_fkey` FOREIGN KEY (`A`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_UserFollows` ADD CONSTRAINT `_UserFollows_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_PostImages` ADD CONSTRAINT `_PostImages_A_fkey` FOREIGN KEY (`A`) REFERENCES `Image`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_PostImages` ADD CONSTRAINT `_PostImages_B_fkey` FOREIGN KEY (`B`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
