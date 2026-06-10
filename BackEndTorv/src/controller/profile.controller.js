const profileRepository = require('../repository/profile.repository');
const { containerClient } = require('../services/azureStorage');
class ProfileController {
  async getProfile(req, res) {
    try {
      console.log('--- [DEBUG] GET /profile ---');
      console.log('Authenticated User:', req.user);

      const { userId } = req.user;

      const user = await profileRepository.getUserProfile(userId);

      if (!user) {
        console.error('--- [DEBUG] Error: User profile not found ---');
        return res.status(404).json({ error: 'User profile not found' });
      }

      const profile = user.user_profiles || {};
      const streaks = user.user_streaks || {};

      // Calculate photo absolute URL
      const host = req.get('host');
      const protocol = req.protocol;
      const photoUrl = profile.photo_url || null;

      res.status(200).json({
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
        workouts_in_month: 0, // MVP static
        followers: 0,         // MVP static
        following: 0,         // MVP static
        total_workouts: 0,    // MVP static
      });
    } catch (error) {
      console.error('Get Profile Error:', error);
      res.status(500).json({ error: 'Internal server error fetching profile' });
    }
  }
  async uploadPhoto(req, res) {
  try {
    console.log('=== UPLOAD PHOTO CHAMADO ===');
    console.log('USER:', req.user);
    console.log('FILE:', req.file);

    if (!req.file) {
      return res.status(400).json({
        error: 'No image file provided'
      });
    }

    const blobName =
      `profile-${userId}-${Date.now()}`;

    const blockBlobClient =
      containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(
      req.file.buffer,
      {
        blobHTTPHeaders: {
          blobContentType: req.file.mimetype
        }
      }
    );

    const photoUrl = blockBlobClient.url;

    await profileRepository.updatePhotoUrl(
      userId,
      photoUrl
    );

    res.status(200).json({
      message: 'Profile photo updated successfully',
      photo_url: photoUrl
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Internal server error uploading photo'
    });
  }
}

  async updateProfile(req, res) {
    try {
      console.log('--- [DEBUG] PUT /profile ---');
      const { userId } = req.user;
      const { username, goal } = req.body;

      if (!username && !goal) {
        console.error('--- [DEBUG] Error: No fields to update ---');
        return res.status(400).json({ error: 'No fields provided for update' });
      }

      const dataToUpdate = {};
      if (username) dataToUpdate.username = username;
      if (goal) dataToUpdate.goal = goal;

      const updatedProfile = await profileRepository.updateProfile(userId, dataToUpdate);

      res.status(200).json({
        message: 'Profile updated successfully',
        profile: updatedProfile,
      });
    } catch (error) {
      console.error('Update Profile Error:', error);
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Username is already taken' });
      }
      res.status(500).json({ error: 'Internal server error updating profile' });
    }
  }
}

module.exports = new ProfileController();
