import { supabase } from './supabase-client.js';

export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { profile: null, bankDetails: [], email: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from('guide_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError && profileError.code !== 'PGRST116') { // PGRST116: single row not found
    console.error('Error fetching profile:', profileError);
    return { profile: null, bankDetails: [], email: user.email };
  }

  const { data: bankDetails, error: bankDetailsError } = await supabase
    .from('bank_details')
    .select('*')
    .eq('user_id', user.id);

  if (bankDetailsError) {
    console.error('Error fetching bank details:', bankDetailsError);
  }

  return { profile, bankDetails: bankDetails || [], email: user.email };
}

export async function updateProfile(profileData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
        .from('guide_profiles')
        .update(profileData)
        .eq('id', user.id);

    if (error) {
        console.error('Error updating profile:', error);
        throw error;
    }
    return getProfile();
}

export async function upsertBankDetail(bankDetail) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const payload = { ...bankDetail, user_id: user.id };

    const { data, error } = await supabase
        .from('bank_details')
        .upsert(payload)
        .select()
        .single();

    if (error) {
        console.error('Error upserting bank detail:', error);
        throw error;
    }
    return data;
}

export async function deleteBankDetail(bankDetailId) {
    const { error } = await supabase
        .from('bank_details')
        .delete()
        .eq('id', bankDetailId);
    if (error) {
        console.error('Error deleting bank detail:', error);
        throw error;
    }
}

export async function uploadProfilePicture(file) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file);

    if (uploadError) {
        console.error('Error uploading profile picture:', uploadError);
        throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

    const { error: updateError } = await supabase
        .from('guide_profiles')
        .update({ profile_picture_url: publicUrl })
        .eq('id', user.id);
    
    if (updateError) {
        console.error('Error updating profile picture URL:', updateError);
        // Attempt to remove the uploaded file if the profile update fails
        await supabase.storage.from('profile-pictures').remove([filePath]);
        throw updateError;
    }

    return publicUrl;
}

export async function deleteProfilePicture() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: profile, error: profileError } = await supabase
        .from('guide_profiles')
        .select('profile_picture_url')
        .eq('id', user.id)
        .single();

    if (profileError || !profile || !profile.profile_picture_url) {
        console.error('Error fetching profile for picture deletion or no picture to delete.');
        return;
    }

    const fileName = profile.profile_picture_url.split('/').pop();

    const { error: removeError } = await supabase.storage
        .from('profile-pictures')
        .remove([fileName]);

    if (removeError) {
        console.error('Error deleting profile picture from storage:', removeError);
        throw removeError;
    }

    const { error: updateError } = await supabase
        .from('guide_profiles')
        .update({ profile_picture_url: null })
        .eq('id', user.id);

    if (updateError) {
        console.error('Error clearing profile picture URL:', updateError);
        throw updateError;
    }
}

export async function getAllProfiles() {
    const { data, error } = await supabase.from('guide_profiles').select('*');
    if (error) throw error;
    return data;
}
