import { supabaseAdmin } from '../server/lib/supabaseAdmin';

async function createWorkoutFeedbackTable() {
  console.log('Creating workout_feedback table in Supabase...');
  
  // Create the table using raw SQL
  const { data, error } = await supabaseAdmin.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS workout_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workout_id UUID NOT NULL,
        user_id UUID NOT NULL,
        perceived_intensity SMALLINT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS workout_feedback_user_workout_unique 
        ON workout_feedback(user_id, workout_id);
    `
  });

  if (error) {
    console.error('Error creating table:', error);
    
    // Alternative approach: Use direct SQL execution
    console.log('Trying alternative approach with direct query...');
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS workout_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workout_id UUID NOT NULL,
        user_id UUID NOT NULL,
        perceived_intensity SMALLINT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    
    const createIndexSQL = `
      CREATE UNIQUE INDEX IF NOT EXISTS workout_feedback_user_workout_unique 
        ON workout_feedback(user_id, workout_id);
    `;

    try {
      // Execute via Supabase SQL editor approach
      const tableResult = await (supabaseAdmin as any).from('').select('').rpc('exec', { query: createTableSQL });
      console.log('Table creation result:', tableResult);
      
      const indexResult = await (supabaseAdmin as any).from('').select('').rpc('exec', { query: createIndexSQL });
      console.log('Index creation result:', indexResult);
    } catch (err) {
      console.error('Alternative approach failed:', err);
      console.log('\n⚠️  MANUAL ACTION REQUIRED:');
      console.log('Please create the workout_feedback table manually in Supabase:');
      console.log('\n1. Go to Supabase Dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Run this SQL:\n');
      console.log(createTableSQL);
      console.log(createIndexSQL);
    }
  } else {
    console.log('✅ Table created successfully!', data);
  }
}

createWorkoutFeedbackTable();
