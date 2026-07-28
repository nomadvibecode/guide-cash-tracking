import { supabase } from './supabase-client.js';

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase configuration is missing.');
  }

  return supabase;
}

function displayNameFromEmail(email) {
  const localPart = (email ?? 'guide').split('@')[0];

  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function loadToursPageData() {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from('tours')
    .select(`
      id,
      tour_name,
      start_date,
      end_date,
      status,
      guest_count,
      tour_guide_id,
      created_at,
      tour_guides (
        guide_id,
        guide_profiles (
          id,
          display_name,
          email
        )
      )
    `)
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function createTourForGuide({ user, tourName, startDate, endDate, status, guestCount }) {
  const client = requireSupabaseClient();
  const guideDisplayName = displayNameFromEmail(user.email);

  const { data: createdTour, error: tourError } = await client
    .from('tours')
    .insert({
      tour_name: tourName,
      start_date: startDate,
      end_date: endDate,
      tour_guide_id: user.id,
      status,
      guest_count: guestCount,
    })
    .select('id, tour_name, start_date, end_date, status, guest_count')
    .single();

  if (tourError) {
    throw tourError;
  }

  const { error: guideError } = await client.from('tour_guides').insert({
    tour_id: createdTour.id,
    guide_id: user.id,
  });

  if (guideError) {
    throw guideError;
  }

  return {
    ...createdTour,
    guide_name: guideDisplayName,
  };
}

export async function joinTour({ tourId, guideId }) {
  const client = requireSupabaseClient();

  const { data: existingAssignments, error: fetchError } = await client
    .from('tour_guides')
    .select('guide_id')
    .eq('tour_id', tourId);

  if (fetchError) {
    throw fetchError;
  }

  if (existingAssignments.some((assignment) => assignment.guide_id === guideId)) {
    return { joined: false, reason: 'already_assigned' };
  }

  if (existingAssignments.length >= 3) {
    return { joined: false, reason: 'tour_full' };
  }

  const { error: insertError } = await client.from('tour_guides').insert({
    tour_id: tourId,
    guide_id: guideId,
  });

  if (insertError) {
    throw insertError;
  }

  return { joined: true };
}

export async function getAllTours() {
  const { data, error } = await supabase
    .from('tours')
    .select(`
      *,
      tour_guides (
        guide_id,
        guide_profiles (
          id,
          display_name
        )
      )
    `)
    .order('start_date', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function addTour(tourData) {
  const { data, error } = await supabase
    .from('tours')
    .insert(tourData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateTour(tourId, tourData) {
  const { data, error } = await supabase
    .from('tours')
    .update(tourData)
    .eq('id', tourId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteTour(tourId) {
  const { error } = await supabase
    .from('tours')
    .delete()
    .eq('id', tourId);

  if (error) {
    throw error;
  }
}

export async function allocateGuidesToTour(tourId, guideIds) {
  const { error: deleteError } = await supabase
    .from('tour_guides')
    .delete()
    .eq('tour_id', tourId);

  if (deleteError) {
    throw deleteError;
  }

  if (!guideIds || guideIds.length === 0) {
    return;
  }

  const rows = guideIds.map((guideId) => ({
    tour_id: tourId,
    guide_id: guideId,
  }));

  const { error: insertError } = await supabase
    .from('tour_guides')
    .insert(rows);

  if (insertError) {
    throw insertError;
  }
}