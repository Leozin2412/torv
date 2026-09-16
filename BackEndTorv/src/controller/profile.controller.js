const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const profileRepository = require('../repository/profile.repository');

class ProfileController {
  async getProfile(request, reply) {
    try {
      const { userId } = request.user;
      const user = await profileRepository.getUserProfile(userId);

      if (!user) {
        return reply.status(404).send({ error: 'User profile not found' });
      }

      const profile = user.user_profiles || {};
      const streaks = user.user_streaks || {};

      const photoUrl = profile.photo_url
        ? `${request.protocol}://${request.headers.host}/uploads/${profile.photo_url}`
        : null;

      reply.status(200).send({
        id: user.id,
        email: user.email,
        username: profile.username,
        name: profile.name,
        fitness_level: profile.fitness_level,
        goal: profile.goal,
        photo_url: photoUrl,
        birth_date: profile.birth_date,
        gender: profile.gender,
        streak: streaks.current_streak || 0,
        longest_streak: streaks.longest_streak || 0,
        workouts_in_month: 0,
        followers: 0,
        following: 0,
        total_workouts: 0,
      });
    } catch (error) {
      request.log.error(error);
      console.error(error);
      reply.status(500).send({ error: 'Internal server error fetching profile' });
    }
  }

  async uploadPhoto(request, reply) {
    try {
      const { userId } = request.user;
      const data = await request.file();
      console.log('[uploadPhoto] received file:', data ? data.filename : 'NONE');

      if (!data) {
        return reply.status(400).send({ error: 'No image file provided' });
      }

      if (!data.mimetype || !data.mimetype.startsWith('image/')) {
        return reply.status(400).send({ error: 'File must be an image' });
      }

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const fileName = `profile-${userId}-${uniqueSuffix}${path.extname(data.filename)}`;
      const destPath = path.join(__dirname, '../../profilePhotos', fileName);
      console.log('[uploadPhoto] writing to:', destPath);

      await pipeline(data.file, fs.createWriteStream(destPath));
      console.log('[uploadPhoto] file written, exists on disk:', fs.existsSync(destPath));

      await profileRepository.updatePhotoUrl(userId, fileName);
      console.log('[uploadPhoto] DB updated with fileName:', fileName);

      const photoUrl = `${request.protocol}://${request.headers.host}/uploads/${fileName}`;

      reply.status(200).send({
        message: 'Profile photo updated successfully',
        photo_url: photoUrl,
      });
    } catch (error) {
      request.log.error(error);
      console.error(error);
      reply.status(500).send({ error: 'Internal server error uploading photo' });
    }
  }

  async updateProfile(request, reply) {
    try {
      const { userId } = request.user;
      const { username, goal } = request.body;
      console.log('[updateProfile] userId:', userId, 'requested username:', username, 'goal:', goal);

      if (!username && !goal) {
        return reply.status(400).send({ error: 'No fields provided for update' });
      }

      const dataToUpdate = {};
      if (username) dataToUpdate.username = username;
      if (goal) dataToUpdate.goal = goal;
      console.log('[updateProfile] dataToUpdate:', dataToUpdate);

      const updatedProfile = await profileRepository.updateProfile(userId, dataToUpdate);
      console.log('[updateProfile] DB result:', updatedProfile);

      reply.status(200).send({
        message: 'Profile updated successfully',
        profile: updatedProfile,
      });
    } catch (error) {
      request.log.error(error);
      console.error(error);
      if (error.code === 'P2002') {
        return reply.status(409).send({ error: 'Username is already taken' });
      }
      reply.status(500).send({ error: 'Internal server error updating profile' });
    }
  }
}

module.exports = new ProfileController();
