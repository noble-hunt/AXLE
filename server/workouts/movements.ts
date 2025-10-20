import { Movement } from "../../shared/workoutSchema";

export const MOVEMENTS: Movement[] = [
  // Bodyweight - Lower
  { id:"air-squat", name:"Air Squat", equipment:["bodyweight"], tags:["lower","squat","warmup"] },
  { id:"reverse-lunge", name:"Reverse Lunge", equipment:["bodyweight"], tags:["lower","lunge"] },
  { id:"forward-lunge", name:"Forward Lunge", equipment:["bodyweight"], tags:["lower","lunge"] },
  { id:"jump-squat", name:"Jump Squat", equipment:["bodyweight"], tags:["lower","squat","power","conditioning"] },
  { id:"single-leg-glute-bridge", name:"Single-Leg Glute Bridge", equipment:["bodyweight"], tags:["lower","hinge","glute"] },
  { id:"wall-sit", name:"Wall Sit", equipment:["bodyweight"], tags:["lower","squat","iso"] },
  { id:"cossack-squat", name:"Cossack Squat", equipment:["bodyweight"], tags:["lower","squat","mobility"] },
  { id:"bulgarian-split-squat", name:"Bulgarian Split Squat", equipment:["bodyweight"], tags:["lower","lunge","unilateral"] },
  
  // Bodyweight - Upper
  { id:"pushup", name:"Push-up", equipment:["bodyweight"], tags:["upper","push","core"] },
  { id:"pike-pushup", name:"Pike Push-up", equipment:["bodyweight"], tags:["upper","push","shoulders"] },
  { id:"diamond-pushup", name:"Diamond Push-up", equipment:["bodyweight"], tags:["upper","push","triceps"] },
  { id:"wide-pushup", name:"Wide Push-up", equipment:["bodyweight"], tags:["upper","push","chest"] },
  { id:"decline-pushup", name:"Decline Push-up", equipment:["bodyweight"], tags:["upper","push","advanced"] },
  { id:"pullup", name:"Pull-up", equipment:["bodyweight","pullup-bar"], tags:["upper","pull","back"] },
  { id:"chinup", name:"Chin-up", equipment:["bodyweight","pullup-bar"], tags:["upper","pull","biceps"] },
  { id:"dip", name:"Dip", equipment:["bodyweight","dip-bar"], tags:["upper","push","triceps"] },
  
  // Bodyweight - Core
  { id:"plank", name:"Plank", equipment:["bodyweight"], tags:["core","iso","warmup"] },
  { id:"side-plank", name:"Side Plank", equipment:["bodyweight"], tags:["core","iso","lateral"] },
  { id:"mountain-climber", name:"Mountain Climber", equipment:["bodyweight"], tags:["core","conditioning","full"] },
  { id:"bicycle-crunch", name:"Bicycle Crunch", equipment:["bodyweight"], tags:["core","rotation"] },
  { id:"dead-bug", name:"Dead Bug", equipment:["bodyweight"], tags:["core","stability","warmup"] },
  { id:"bird-dog", name:"Bird Dog", equipment:["bodyweight"], tags:["core","stability","warmup"] },
  
  // Bodyweight - Full Body
  { id:"burpee", name:"Burpee", equipment:["bodyweight"], tags:["conditioning","full","power"] },
  { id:"bear-crawl", name:"Bear Crawl", equipment:["bodyweight"], tags:["full","core","conditioning"] },
  { id:"star-jump", name:"Star Jump", equipment:["bodyweight"], tags:["full","conditioning","power"] },
  { id:"inchworm", name:"Inchworm", equipment:["bodyweight"], tags:["full","mobility","warmup"] },
  
  // Dumbbell - Lower  
  { id:"db-goblet-squat", name:"Goblet Squat", equipment:["dumbbell"], tags:["squat","lower","strength"] },
  { id:"db-rdl", name:"DB RDL", equipment:["dumbbell"], tags:["hinge","lower","strength"] },
  { id:"db-lunge", name:"DB Lunge", equipment:["dumbbell"], tags:["lunge","lower","strength"] },
  { id:"db-step-up", name:"DB Step-up", equipment:["dumbbell"], tags:["lower","unilateral","strength"] },
  { id:"db-calf-raise", name:"DB Calf Raise", equipment:["dumbbell"], tags:["lower","calf","strength"] },
  { id:"db-sumo-squat", name:"DB Sumo Squat", equipment:["dumbbell"], tags:["squat","lower","strength"] },
  
  // Dumbbell - Upper
  { id:"db-bench", name:"DB Bench Press", equipment:["dumbbell"], tags:["upper","push","strength"] },
  { id:"db-row", name:"DB Row", equipment:["dumbbell"], tags:["upper","pull","strength"] },
  { id:"db-shoulder-press", name:"DB Shoulder Press", equipment:["dumbbell"], tags:["upper","push","shoulders","strength"] },
  { id:"db-bicep-curl", name:"DB Bicep Curl", equipment:["dumbbell"], tags:["upper","pull","biceps"] },
  { id:"db-tricep-extension", name:"DB Tricep Extension", equipment:["dumbbell"], tags:["upper","push","triceps"] },
  { id:"db-lateral-raise", name:"DB Lateral Raise", equipment:["dumbbell"], tags:["upper","shoulders","isolation"] },
  { id:"db-chest-fly", name:"DB Chest Fly", equipment:["dumbbell"], tags:["upper","push","chest"] },
  { id:"db-reverse-fly", name:"DB Reverse Fly", equipment:["dumbbell"], tags:["upper","pull","rear-delt"] },
  
  // Dumbbell - Full Body
  { id:"db-thruster", name:"DB Thruster", equipment:["dumbbell"], tags:["full","conditioning","power"] },
  { id:"db-clean-press", name:"DB Clean & Press", equipment:["dumbbell"], tags:["full","power","strength"] },
  { id:"db-snatch", name:"DB Snatch", equipment:["dumbbell"], tags:["full","power","unilateral"] },
  { id:"db-man-maker", name:"DB Man Maker", equipment:["dumbbell"], tags:["full","conditioning","complex"] },
  
  // Kettlebell
  { id:"kb-swing", name:"KB Swing", equipment:["kettlebell"], tags:["hinge","conditioning","power"] },
  { id:"kb-clean", name:"KB Clean", equipment:["kettlebell"], tags:["pull","power","full"] },
  { id:"kb-front-squat", name:"KB Front Squat", equipment:["kettlebell"], tags:["squat","lower","strength"] },
  { id:"kb-push-press", name:"KB Push Press", equipment:["kettlebell"], tags:["push","upper","power"] },
  { id:"kb-snatch", name:"KB Snatch", equipment:["kettlebell"], tags:["full","power","conditioning"] },
  { id:"kb-windmill", name:"KB Windmill", equipment:["kettlebell"], tags:["core","mobility","stability"] },
  { id:"kb-turkish-getup", name:"Turkish Get-up", equipment:["kettlebell"], tags:["full","stability","strength"] },
  { id:"kb-goblet-squat", name:"KB Goblet Squat", equipment:["kettlebell"], tags:["squat","lower","strength"] },
  
  // Barbell
  { id:"bb-back-squat", name:"Back Squat", equipment:["barbell"], tags:["squat","lower","strength"] },
  { id:"bb-front-squat", name:"Front Squat", equipment:["barbell"], tags:["squat","lower","strength"] },
  { id:"bb-deadlift", name:"Deadlift", equipment:["barbell"], tags:["hinge","lower","strength"] },
  { id:"bb-bench", name:"Bench Press", equipment:["barbell"], tags:["push","upper","strength"] },
  { id:"bb-ohp", name:"Overhead Press", equipment:["barbell"], tags:["push","upper","strength"] },
  { id:"bb-row", name:"Barbell Row", equipment:["barbell"], tags:["pull","upper","strength"] },
  { id:"bb-clean", name:"Power Clean", equipment:["barbell"], tags:["full","power","strength"] },
  { id:"bb-thruster", name:"Thruster", equipment:["barbell"], tags:["full","conditioning","strength"] },
  
  // Resistance Band
  { id:"band-squat", name:"Band Squat", equipment:["resistance_band"], tags:["squat","lower","strength"] },
  { id:"band-row", name:"Band Row", equipment:["resistance_band"], tags:["pull","upper","strength"] },
  { id:"band-chest-press", name:"Band Chest Press", equipment:["resistance_band"], tags:["push","upper","strength"] },
  { id:"band-lateral-raise", name:"Band Lateral Raise", equipment:["resistance_band"], tags:["upper","shoulders"] },
  { id:"band-pull-apart", name:"Band Pull Apart", equipment:["resistance_band"], tags:["pull","upper","warmup"] },
  
  // Medicine Ball
  { id:"med-ball-slam", name:"Medicine Ball Slam", equipment:["medicine_ball"], tags:["full","power","conditioning"] },
  { id:"med-ball-throw", name:"Medicine Ball Throw", equipment:["medicine_ball"], tags:["full","power","core"] },
  
  // Cardio Equipment
  { id:"row", name:"Row", equipment:["bodyweight"], tags:["cardio","conditioning","full"] },
  { id:"bike", name:"Bike", equipment:["bodyweight"], tags:["cardio","conditioning","lower"] },
  { id:"ski-erg", name:"Ski Erg", equipment:["bodyweight"], tags:["cardio","conditioning","full"] },
  { id:"run", name:"Run", equipment:["bodyweight"], tags:["cardio","conditioning","lower"] },
  { id:"assault-bike", name:"Assault Bike", equipment:["bodyweight"], tags:["cardio","conditioning","full"] },
  
  // Mobility/Warmup
  { id:"arm-circle", name:"Arm Circle", equipment:["bodyweight"], tags:["mobility","warmup","upper"] },
  { id:"leg-swing", name:"Leg Swing", equipment:["bodyweight"], tags:["mobility","warmup","lower"] },
  { id:"hip-circle", name:"Hip Circle", equipment:["bodyweight"], tags:["mobility","warmup","lower"] },
  { id:"cat-cow", name:"Cat-Cow", equipment:["bodyweight"], tags:["mobility","warmup","spine"] },
];