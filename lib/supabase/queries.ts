import { createClient } from './server'
import type { Database } from '../database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type Property = Database['public']['Tables']['properties']['Row']
type Booking = Database['public']['Tables']['bookings']['Row']
type Inquiry = Database['public']['Tables']['inquiries']['Row']

// Profile queries
export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  return data
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`)
  }

  return data
}

// Property queries
export async function getProperties(filters?: {
  city?: string
  property_type?: string
  min_price?: number
  max_price?: number
  bedrooms?: number
  status?: string
  featured?: boolean
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()
  
  let query = supabase
    .from('properties')
    .select(`
      *,
      agent:profiles!properties_agent_id_fkey(
        id,
        full_name,
        company,
        phone
      )
    `)

  if (filters?.city) {
    query = query.eq('city', filters.city)
  }
  
  if (filters?.property_type) {
    query = query.eq('property_type', filters.property_type)
  }
  
  if (filters?.min_price) {
    query = query.gte('price', filters.min_price)
  }
  
  if (filters?.max_price) {
    query = query.lte('price', filters.max_price)
  }
  
  if (filters?.bedrooms) {
    query = query.eq('bedrooms', filters.bedrooms)
  }
  
  if (filters?.status) {
    query = query.eq('status', filters.status)
  } else {
    // Default to available properties only
    query = query.eq('status', 'available')
  }
  
  if (filters?.featured !== undefined) {
    query = query.eq('featured', filters.featured)
  }

  query = query
    .order('created_at', { ascending: false })
    .range(filters?.offset || 0, (filters?.offset || 0) + (filters?.limit || 20) - 1)

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch properties: ${error.message}`)
  }

  return data
}

export async function getProperty(id: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('properties')
    .select(`
      *,
      agent:profiles!properties_agent_id_fkey(
        id,
        full_name,
        company,
        phone,
        avatar_url
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`Failed to fetch property: ${error.message}`)
  }

  return data
}

export async function createProperty(property: Database['public']['Tables']['properties']['Insert']) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('properties')
    .insert(property)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create property: ${error.message}`)
  }

  return data
}

export async function updateProperty(id: string, updates: Database['public']['Tables']['properties']['Update']) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('properties')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update property: ${error.message}`)
  }

  return data
}

// Favorites queries
export async function getUserFavorites(userId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('favorites')
    .select(`
      property_id,
      created_at,
      properties:properties!favorites_property_id_fkey(
        id,
        title_en,
        price,
        images,
        city,
        property_type,
        status
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch favorites: ${error.message}`)
  }

  return data
}

export async function toggleFavorite(userId: string, propertyId: string) {
  const supabase = await createClient()
  
  // Check if already favorited
  const { data: existing } = await supabase
    .from('favorites')
    .select('*')
    .eq('user_id', userId)
    .eq('property_id', propertyId)
    .single()

  if (existing) {
    // Remove from favorites
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('property_id', propertyId)

    if (error) {
      throw new Error(`Failed to remove favorite: ${error.message}`)
    }
    
    return { favorited: false }
  } else {
    // Add to favorites
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: userId, property_id: propertyId })

    if (error) {
      throw new Error(`Failed to add favorite: ${error.message}`)
    }
    
    return { favorited: true }
  }
}

// Booking queries
export async function createBooking(booking: Database['public']['Tables']['bookings']['Insert']) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('bookings')
    .insert(booking)
    .select(`
      *,
      property:properties!bookings_property_id_fkey(
        id,
        title_en,
        city,
        images
      ),
      user:profiles!bookings_user_id_fkey(
        id,
        full_name,
        phone
      )
    `)
    .single()

  if (error) {
    throw new Error(`Failed to create booking: ${error.message}`)
  }

  return data
}

export async function getUserBookings(userId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      property:properties!bookings_property_id_fkey(
        id,
        title_en,
        city,
        images,
        agent_id
      )
    `)
    .eq('user_id', userId)
    .order('scheduled_date', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch bookings: ${error.message}`)
  }

  return data
}

export async function updateBookingStatus(
  id: string, 
  status: Database['public']['Enums']['booking_status']
) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('bookings')
    .update({ 
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update booking: ${error.message}`)
  }

  return data
}

// Inquiry queries
export async function createInquiry(inquiry: Database['public']['Tables']['inquiries']['Insert']) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('inquiries')
    .insert(inquiry)
    .select(`
      *,
      property:properties!inquiries_property_id_fkey(
        id,
        title_en,
        agent_id
      ),
      user:profiles!inquiries_user_id_fkey(
        id,
        full_name,
        phone
      )
    `)
    .single()

  if (error) {
    throw new Error(`Failed to create inquiry: ${error.message}`)
  }

  return data
}

export async function getPropertyInquiries(propertyId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('inquiries')
    .select(`
      *,
      user:profiles!inquiries_user_id_fkey(
        id,
        full_name,
        phone
      )
    `)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch inquiries: ${error.message}`)
  }

  return data
}