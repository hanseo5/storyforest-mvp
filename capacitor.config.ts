import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.storyforest.app',
  appName: 'StoryForest',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '580984401842-anh7p8iiiv1fd8bms0q6t1tmptbaq7kd.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    }
  }
};

export default config;
