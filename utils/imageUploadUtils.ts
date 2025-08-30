import { API_BASE_URL } from '../config/apiConfig';

/**
 * Uploads an image for a recipe and updates the recipe status
 * @param recipeId - The ID of the recipe to update
 * @param imageUri - The local URI of the image to upload
 */
export const uploadImageAsync = async (recipeId: string, imageUri: string): Promise<void> => {
  try {
    // Upload to Cloudinary
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'recipe-image.jpg',
    } as any);

    const imageResponse = await fetch(`${API_BASE_URL}/api/upload-image`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const imageResult = await imageResponse.json();

    if (imageResult.success) {
      // Update recipe with image URL
      await fetch(`${API_BASE_URL}/api/recipes/${recipeId}/image`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imageResult.imageUrl,
          imageStatus: 'ready'
        }),
      });
    } else {
      // Mark image as failed
      await fetch(`${API_BASE_URL}/api/recipes/${recipeId}/image`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: null,
          imageStatus: 'failed'
        }),
      });
      console.log('Background image upload failed');
    }
  } catch (error) {
    console.error('Background image upload error:', error);
    // Mark image as failed
    try {
      await fetch(`${API_BASE_URL}/api/recipes/${recipeId}/image`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: null,
          imageStatus: 'failed'
        }),
      });
    } catch (updateError) {
      console.error('Failed to update image status:', updateError);
    }
  }
};
