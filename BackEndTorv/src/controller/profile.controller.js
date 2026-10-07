const profileRepository = require('../repository/profile.repository');
const { validateProfileUpdate } = require('../lib/profileValidation');
const { buildSuggestion } = require('../lib/nutritionSuggestion');
const { ageOn } = require('../lib/nutritionCalculator');
const { readImage, saveImage } = require('../lib/imageUpload');

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
      const image = await readImage(request);
      if (image.error) return reply.status(image.status).send({ error: image.error });

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const fileName = `profile-${userId}-${uniqueSuffix}${image.ext}`;
      await saveImage(fileName, image.buffer);

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
