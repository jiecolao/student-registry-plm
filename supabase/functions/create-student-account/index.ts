import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: adminRole, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (roleError) throw roleError
    if (!adminRole) throw new Error('Admin access required')

    const body = await req.json()
    const studentId = String(body.student_id || '').trim()
    const studentNumber = String(body.student_number || '').trim()
    const password = String(body.password || '')

    if (!studentId || !studentNumber || !password) {
      throw new Error('student_id, student_number, and password are required')
    }
    if (password.length < 8) throw new Error('Password must be at least 8 characters')

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: student, error: studentError } = await adminClient
      .from('students')
      .select('id, student_number')
      .eq('id', studentId)
      .single()
    if (studentError) throw studentError
    if (student.student_number !== studentNumber) throw new Error('Student number does not match the student record')

    const syntheticEmail = `${studentNumber.toLowerCase().replace(/[^a-z0-9._-]/g, '-') }@students.nursync.internal`

    const { data: existingAccount } = await adminClient
      .from('student_accounts')
      .select('user_id')
      .eq('student_id', studentId)
      .maybeSingle()

    let userId = existingAccount?.user_id

    if (userId) {
      const { error } = await adminClient.auth.admin.updateUserById(userId, { password })
      if (error) throw error
    } else {
      const { data: created, error } = await adminClient.auth.admin.createUser({
        email: syntheticEmail,
        password,
        email_confirm: true,
      })
      if (error) throw error
      userId = created.user.id

      const { error: accountError } = await adminClient
        .from('student_accounts')
        .insert({ user_id: userId, student_id: studentId })
      if (accountError) {
        await adminClient.auth.admin.deleteUser(userId)
        throw accountError
      }

      const { error: roleInsertError } = await adminClient
        .from('user_roles')
        .insert({ user_id: userId, role: 'student' })
      if (roleInsertError) {
        await adminClient.from('student_accounts').delete().eq('user_id', userId)
        await adminClient.auth.admin.deleteUser(userId)
        throw roleInsertError
      }
    }

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
