const path = require('path');
const fs = require('fs');
const profileRepository = require('../repository/profile.repository');
const { validateProfileUpdate } = require('../lib/profileValidation');
const { buildSuggestion } = require('../lib/nutritionSuggestion');
const { ageOn } = require('../lib/nutritionCalculator');

const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function hasValidImageSignature(buffer, mimetype) {
  if (mimetype === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimetype === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimetype === 'image/webp') {
    return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

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
      const measurement = user.user_measurements?.[0];

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
        weight_kg: measurement?.weight_kg != null ? Number(measurement.weight_kg) : null,
        height_cm: measurement?.height_cm ?? null,
        age: profile.birth_date ? ageOn(profile.birth_date, new Date()) : null,
        streak: streaks.current_streak || 0,
        longest_streak: streaks.longest_streak || 0,
        workouts_in_month: user.workout_counts.month,
        followers: 0,
        following: 0,
        total_workouts: user.workout_counts.total,
        welcome_pending: profile.welcomed_at == null,
      });
    } catch (error) {
      request.log.error(error);
      console.error(error);
      reply.status(500).send({ error: 'Internal server error fetching profile' });
    }
  }

  async markWelcomed(request, reply) {
    await profileRepository.markWelcomed(request.user.userId);
    return reply.status(204).send();
  }

  async uploadPhoto(request, reply) {
    try {
      const { userId } = request.user;
      const data = await request.file();
      console.log('[uploadPhoto] received file:', data ? data.filename : 'NONE');

      if (!data) {
        return reply.status(400).send({ error: 'No image file provided' });
      }

      const ext = ALLOWED_IMAGE_TYPES[data.mimetype];
      if (!ext) {
        return reply.status(400).send({ error: 'File must be a JPEG, PNG, or WebP image' });
      }

      const buffer = await data.toBuffer();
      if (!hasValidImageSignature(buffer, data.mimetype)) {
        return reply.status(400).send({ error: 'File content does not match a JPEG, PNG, or WebP image' });
      }

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const fileName = `profile-${userId}-${uniqueSuffix}${ext}`;
      const destPath = path.join(__dirname, '../../profilePhotos', fileName);
      console.log('[uploadPhoto] writing to:', destPath);

      await fs.promises.writeFile(destPath, buffer);
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
      const result = validateProfileUpdate(request.body);
      if (result.error) {
        return reply.status(400).send({ error: result.error });
      }

      const [updatedProfile, last] = await Promise.all([
        Object.keys(result.profileData).length > 0
          ? profileRepository.updateProfile(userId, result.profileData)
          : profileRepository.getProfileRow(userId),
        result.measurement ? profileRepository.getLatestMeasurement(userId) : null,
      ]);

      if (result.measurement) {
        const next = {
          weight_kg: result.measurement.weight_kg ?? (last?.weight_kg != null ? Number(last.weight_kg) : null),
          height_cm: result.measurement.height_cm ?? last?.height_cm ?? null,
        };
        const changed = !last
          || Number(last.weight_kg) !== Number(next.weight_kg)
          || last.height_cm !== next.height_cm;
        if (changed) await profileRepository.addMeasurement(userId, next);
      }

      reply.status(200).send({
        message: 'Profile updated successfully',
        profile: updatedProfile,
        nutrition_suggestion: await buildSuggestion(userId),
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
