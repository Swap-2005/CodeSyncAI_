const port = 5000;
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const cron = require("node-cron");

// Import models
const Analytics = require('./models/Analytics');
const Performance = require('./models/Performance');
const Question = require('./models/Question');
const Users = require('./models/Users');

// Import analytics routes
const analyticsRoutes = require('./routes/analytics');

app.use(express.json());
app.use(cors());

// MongoDB Connection with proper error handling
let isMongoConnected = false;

mongoose.connect('mongodb://localhost:27017/Dsa-assistant', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
}).then(() => {
    console.log('Connected to MongoDB successfully');
    isMongoConnected = true;
}).catch((err) => {
    console.error('MongoDB connection error:', err);
    isMongoConnected = false;
});

mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
    isMongoConnected = false;
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
    isMongoConnected = false;
});

mongoose.connection.on('connected', () => {
    console.log('MongoDB connected');
    isMongoConnected = true;
});

// Middleware to fetch user
const fetchUser = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: "Please authenticate using a valid token" });
    }
    try {
        const data = jwt.verify(token, 'secret_ecom');
        req.user = data.user;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Please authenticate using a valid token" });
    }
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        mongodb: isMongoConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// API creation
app.get('/', (req, res) => {
    res.send('Express App is running');
});

// Use analytics routes
app.use('/api/analytics', analyticsRoutes);

// Constants for question time estimates
const TIME_PER_QUESTION = {
    'Easy': 20,
    'Medium': 30,
    'Hard': 45
};

const PRIORITY_ORDER = [
    [1, "Easy"], [2, "Easy"],
    [1, "Medium"], [2, "Medium"],
    [1, "Hard"], [2, "Hard"],
    [3, "Easy"], [3, "Medium"], [3, "Hard"]
];

// Register endpoint
app.post('/signup', async (req, res) => {
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
      return res.status(400).json({ success: false, errors: 'Existing user found' });
  }

  let cart = {};
  for (let i = 0; i < 300; i++) {
      cart[i] = 0;
  }

  const user = new Users({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,  
      cartData: cart,
  });

  await user.save();

  const data = {
      user: {
          id: user._id
      }
  };

  const token = jwt.sign(data, 'secret_ecom');

  res.json({ success: true, token, userId: user._id });
});

// Login endpoint
app.post('/login', async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
      const passCompare = req.body.password === user.password;
      if (passCompare) {
          const data = {
              user: {
                  id: user.id
              }
          };
          const token = jwt.sign(data, 'secret_ecom');
          
          res.json({ success: true, token, userId: user._id });
      } else {
          res.json({ success: false, errors: "Wrong password" });
      }
  } else {
      res.json({ success: false, errors: 'Wrong email ID' });
  }
});

// Save performance endpoint
app.post('/save-performance', fetchUser, async (req, res) => {
    try {
        if (!isMongoConnected) {
            return res.status(503).json({ error: 'Database not available' });
        }

        const { questionId, status, attempts, skips, timeSpent, difficulty } = req.body;
        
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        const userId = req.user.id;
        
        // Validate required fields
        if (!questionId) {
            return res.status(400).json({ error: 'questionId is required' });
        }

        if (!status) {
            return res.status(400).json({ error: 'status is required' });
        }
        
        // Validate questionId format and convert to ObjectId
        let questionObjectId;
        try {
            questionObjectId = new mongoose.Types.ObjectId(questionId);
        } catch (error) {
            return res.status(400).json({ error: 'Invalid question ID format' });
        }

        // Verify question exists
        const questionExists = await Question.findById(questionObjectId);
        if (!questionExists) {
            return res.status(404).json({ error: 'Question not found' });
        }

        // Validate status
        if (!['completed', 'skipped', 'attempted', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        // Find or create performance record
        let performance = await Performance.findOne({ userId });
        if (!performance) {
            performance = new Performance({ 
                userId: new mongoose.Types.ObjectId(userId),
                questions: []
            });
        }

        // Find existing question in performance record
        const questionIndex = performance.questions.findIndex(
            q => q.questionId && q.questionId.toString() === questionObjectId.toString()
        );

        // Prepare question data
        const questionData = {
            questionId: questionObjectId,
            status,
            attempts: parseInt(attempts) || 0,
            skips: parseInt(skips) || 0,
            timeSpent: parseInt(timeSpent) || 0,
            difficulty: (difficulty || questionExists.difficultylevel || 'medium').toLowerCase(),
            lastAttempted: new Date()
        };

        // Update or add question data
        if (questionIndex > -1) {
            // Update existing question
            performance.questions[questionIndex] = {
                ...performance.questions[questionIndex].toObject(),
                ...questionData
            };
        } else {
            // Add new question
            performance.questions.push(questionData);
        }

        // Save and validate
        try {
            const savedPerformance = await performance.save();
            res.json({ 
                success: true,
                message: 'Performance saved successfully',
                data: savedPerformance.questions[questionIndex > -1 ? questionIndex : savedPerformance.questions.length - 1]
            });
        } catch (validationError) {
            console.error('Validation error:', validationError);
            return res.status(400).json({ 
                error: 'Validation failed',
                details: validationError.message
            });
        }
    } catch (error) {
        console.error('Error saving performance:', error);
        res.status(500).json({ 
            error: 'Internal server error while saving performance',
            details: error.message
        });
    }
});

// Helper function to sort questions by priority and difficulty
function sortQuestions(questions) {
    const difficultyWeights = {
        'Easy': 1,
        'Medium': 2,
        'Hard': 3
    };

    return questions.sort((a, b) => {
        // First sort by priority (higher priority first)
        if (b.priority !== a.priority) {
            return b.priority - a.priority;
        }
        
        // Then sort by difficulty weight (lower difficulty first)
        const diffA = difficultyWeights[a.difficultylevel] || 2;
        const diffB = difficultyWeights[b.difficultylevel] || 2;
        return diffA - diffB;
    });
}

// Modify generateSchedule function
const generateSchedule = async (userInput) => {
    let { proficiency, dailyTime, startDate, enoughTime, userId } = userInput;

    // Fetch questions
    let questions = await Question.find({});

    // Get user's performance data
    const performance = await Performance.findOne({ userId });
    
    // Filter out completed and skipped questions
    if (performance) {
        const completedOrSkippedIds = performance.questions
            .filter(q => q.status === 'completed' || q.skips > 0)
            .map(q => q.questionId.toString());
        
        questions = questions.filter(q => !completedOrSkippedIds.includes(q._id.toString()));
    }

    // Filter questions based on proficiency level
    questions = filterByProficiency(questions, proficiency);

    // Sort questions by priority and difficulty
    questions = sortQuestions(questions);

    // Allocate questions to the schedule based on user input
    let schedule = allocateQuestions(questions, dailyTime, new Date(startDate), enoughTime);
    return schedule;
};

const groupQuestionsByTopic = (questions) => {
    return questions.reduce((acc, q) => {
        if (!acc[q.topic]) acc[q.topic] = [];
        acc[q.topic].push(q);
        return acc;
    }, {});
};
// Filter questions by user proficiency
const filterByProficiency = (questions, proficiency) => {
    return questions.filter(q => {
        let userLevel = proficiency[q.topic] || "Beginner";
        if (userLevel === "Expert") {
            // For experts, include Medium and Hard questions
            return ["Medium", "Hard"].includes(q.difficultylevel);
        } 
        if (userLevel === "Intermediate") {
            // For intermediate, include Medium and Hard questions, but Medium first
            return ["Medium", "Hard"].includes(q.difficultylevel);
        }
        // For beginners, include Easy questions first, then Medium, then Hard
        if (userLevel === "Beginner") {
            return ["Easy", "Medium", "Hard"].includes(q.difficultylevel);
        }
        return false;
    });
};

// Allocate questions to each day based on the user input and the available time
const allocateQuestions = (questions, dailyTime, startDate, enoughTime) => {
    let schedule = {};
    let currentDate = new Date(); // Start from today
    let endDate = new Date(startDate); // Convert user-selected date to Date object
    let groupedQuestions = groupQuestionsByTopic(questions);

    let topics = Object.keys(groupedQuestions);
    let remainingQuestions = topics.map(topic => [...groupedQuestions[topic]]);

    while (remainingQuestions.some(arr => arr.length > 0) && currentDate <= endDate) {
        let timeLeft = dailyTime;
        let dayQuestions = [];

        for (let i = 0; i < topics.length; i++) {
            let topic = topics[i];
            if (remainingQuestions[i].length > 0) {
                let q = remainingQuestions[i].shift(); // Take the first question
                let qTime = TIME_PER_QUESTION[q.difficultylevel];

                if (timeLeft >= qTime) {
                    dayQuestions.push({ _id:q._id,topic: q.topic,question:q.question, link: q.link, time: qTime });
                    timeLeft -= qTime;
                } else {
                    remainingQuestions[i].unshift(q); // Put back if not enough time
                }
            }
        }

        if (dayQuestions.length > 0) {
            schedule[currentDate.toISOString().split("T")[0]] = dayQuestions;
        }

        currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
    }

    return schedule;
};


// API Endpoint to Generate Schedule
app.post("/generate-schedule", fetchUser, async (req, res) => {
    console.log("entered generate-schedule");
    try {
        const schedule = await generateSchedule(req.body);  // Pass userInput to generateSchedule
        res.json(schedule); // Return the generated schedule
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetch unique topics from the database
app.get("/get-topics", async (req, res) => {
    try {
        const questions = await Question.find({}, "topic");
        const uniqueTopics = [...new Set(questions.map(q => q.topic))];
        res.json({ topics: uniqueTopics });
    } catch (error) {
        console.error("Error fetching topics:", error);
        res.status(500).json({ error: "Failed to fetch topics" });
    }
});
app.get("/get-user", async (req, res) => {
    try {   
      const user = await user.findById(req.user.id);
      res.json({ success: true, userId: user._id });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });
  
  const ScheduleSchema = new mongoose.Schema(
    {
      userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
      schedules: [
        {
          scheduleId: {
            type: mongoose.Schema.Types.ObjectId,
            default: () => new mongoose.Types.ObjectId(),
          },
          dates: [
            {
              date: { type: String, required: true },
              questions: [
                {
                  questionId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Question" },
                  status: { type: String, enum: ["pending", "completed"], default: "pending" },
                },
              ],
            },
          ],
        },
      ],
    },
    { timestamps: true }
  );
  
  const Schedule = mongoose.model("Schedule", ScheduleSchema);
  
  app.post("/save-schedule", async (req, res) => {
    try {
      const { userId, schedules } = req.body;
  
      // Validate if userId is a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid userId format" });
      }
  
      let userSchedule = await Schedule.findOne({ userId });
  
      if (!userSchedule) {
        userSchedule = new Schedule({ userId, schedules });
      } else {
        userSchedule.schedules.push(...schedules);
      }
  
      await userSchedule.save();
      res.json({ message: "Schedule saved successfully!" });
    } catch (error) {
      console.error("Error saving schedule:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  async function getSchedule(userId, date) {
    return await Schedule.findOne({ userId, date }).populate('questions.questionId');
  }
  async function updateQuestionStatus(scheduleId, questionId, newStatus) {
    await Schedule.updateOne(
      { _id: scheduleId, 'questions.questionId': questionId },
      { $set: { 'questions.$.status': newStatus } }
    );
  }
// Update question status
app.post("/update-question-status", async (req, res) => {
  try {
    const { questionId, newStatus, userId } = req.body;
    
    if (!questionId || !newStatus || !userId) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: questionId, newStatus, or userId" 
      });
    }

    // Find the schedule for this user
    const schedule = await Schedule.findOne({ userId });
    if (!schedule) {
      return res.status(404).json({ 
        success: false, 
        message: "Schedule not found for user" 
      });
    }

    // Find and update the question status in the schedule
    let questionUpdated = false;
    for (const s of schedule.schedules) {
      for (const d of s.dates) {
        const questionIndex = d.questions.findIndex(q => 
          q.questionId.toString() === questionId.toString()
        );
        if (questionIndex !== -1) {
          d.questions[questionIndex].status = newStatus;
          questionUpdated = true;
          break;
        }
      }
      if (questionUpdated) break;
    }

    if (!questionUpdated) {
      return res.status(404).json({ 
        success: false, 
        message: "Question not found in schedule" 
      });
    }

    await schedule.save();

    // Also update the performance record
    let performance = await Performance.findOne({ userId });
    if (!performance) {
      performance = new Performance({ userId, questions: [] });
    }

    const questionPerformance = performance.questions.find(q => 
      q.questionId.toString() === questionId.toString()
    );

    if (questionPerformance) {
      questionPerformance.status = newStatus;
    } else {
      performance.questions.push({
        questionId,
        status: newStatus,
        attempts: 0,
        skips: 0
      });
    }

    await performance.save();

    res.json({ 
      success: true, 
      message: "Question status updated successfully",
      updatedSchedule: schedule 
    });

  } catch (error) {
    console.error("Error updating question status:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while updating question status" 
    });
  }
});

// Schedule job to run every day at midnight
cron.schedule("0 0 * * *", async () => {
  console.log("🔄 Running daily reschedule job...");

  try {
      // Fetch all users with schedules
      const users = await Schedule.find({});

      for (let userSchedule of users) {
          let userId = userSchedule.userId;

          // Fetch user's performance data
          const performance = await Performance.findOne({ userId });

          if (!performance) continue; // Skip if no performance data

          // Extract pending questions from PerformanceSchema
          let pendingQuestions = performance.questions
              .filter(q => q.status === "pending")
              .map(q => q.questionId.toString());

          // Extract upcoming scheduled questions from ScheduleSchema
          let upcomingQuestions = [];
          userSchedule.schedules.forEach(schedule => {
              schedule.dates.forEach(dateEntry => {
                  dateEntry.questions.forEach(q => {
                      upcomingQuestions.push(q.questionId.toString());
                  });
              });
          });

          // Merge pending and upcoming questions (Remove Duplicates)
          let allQuestions = [...new Set([...pendingQuestions, ...upcomingQuestions])];

          // Fetch full question details from existing schedule (No need for `Question` collection)
          let questions = [];
          userSchedule.schedules.forEach(schedule => {
              schedule.dates.forEach(dateEntry => {
                  dateEntry.questions.forEach(q => {
                      if (allQuestions.includes(q.questionId.toString())) {
                          questions.push({
                              _id: q.questionId,
                              topic: q.topic || "Unknown",
                              question: q.question || "No question text",
                              link: q.link || "",
                              difficultylevel: q.difficultylevel || "medium",
                          });
                      }
                  });
              });
          });

          // Run `generateSchedule` on the collected questions
          let newSchedule = await generateSchedule2({
              proficiency: {}, // Fetch if available
              dailyTime: 120, // Default daily time, can be adjusted per user
              startDate: new Date(), // Start from today
              enoughTime: true,
              questions
          });

          // Update schedule in database
          userSchedule.schedules = [
              {
                  scheduleId: new mongoose.Types.ObjectId(),
                  dates: Object.keys(newSchedule).map(date => ({
                      date,
                      questions: newSchedule[date].map(q => ({
                          questionId: q._id,
                          topic: q.topic,
                          question: q.question,
                          link: q.link,
                          status: "pending"
                      }))
                  }))
              }
          ];

          await userSchedule.save();
          console.log(`✅ Rescheduled for user ${userId}`);
      }
  } catch (error) {
      console.error("❌ Error updating schedules:", error);
  }
});
const generateSchedule2 = async (userInput) => {
  let { proficiency, dailyTime, startDate, enoughTime, questions } = userInput;

  // Filter questions based on proficiency (if needed)
  questions = filterByProficiency(questions, proficiency);

  // Sort questions by priority and difficulty
  questions = sortQuestions(questions);

  // Allocate questions to the schedule
  let schedule = allocateQuestions2(questions, dailyTime, new Date(startDate), enoughTime);
  return schedule;
};

const allocateQuestions2 = (questions, dailyTime, startDate, enoughTime) => {
  let schedule = {};
  let currentDate = new Date();
  let endDate = new Date(startDate); // Start from today

  let groupedQuestions = groupQuestionsByTopic(questions);
  let topics = Object.keys(groupedQuestions);
  let remainingQuestions = topics.map(topic => [...groupedQuestions[topic]]);

  while (remainingQuestions.some(arr => arr.length > 0) && currentDate <= endDate) {
      let timeLeft = dailyTime;
      let dayQuestions = [];

      for (let i = 0; i < topics.length; i++) {
          let topic = topics[i];
          if (remainingQuestions[i].length > 0) {
              let q = remainingQuestions[i].shift(); // Take the first question
              let qTime = TIME_PER_QUESTION[q.difficultylevel] || 10; // Default to 10 min

              if (timeLeft >= qTime) {
                  dayQuestions.push({ 
                      _id: q._id, 
                      topic: q.topic, 
                      question: q.question, 
                      link: q.link, 
                      time: qTime 
                  });
                  timeLeft -= qTime;
              } else {
                  remainingQuestions[i].unshift(q); // Put back if not enough time
              }
          }
      }

      if (dayQuestions.length > 0) {
          schedule[currentDate.toISOString().split("T")[0]] = dayQuestions;
      }

      currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
  }

  return schedule;
};
app.get("/api/check-schedule/:userId", async (req, res) => {
  try {
      const { userId } = req.params;

      // Check if the user has a saved schedule
      const schedule = await Schedule.findOne({ userId });

      if (schedule && schedule.schedules.length > 0) {
          return res.json({ hasSchedule: true });
      } else {
          return res.json({ hasSchedule: false });
      }
  } catch (error) {
      console.error("Error checking schedule:", error);
      res.status(500).json({ message: "Server error" });
  }
});

app.get('/schedules/:userId', async (req, res) => {
  try {
      const userId = req.params.userId;
      const userSchedule = await Schedule.findOne({ userId });

      if (!userSchedule) {
          return res.status(404).json({ success: false, message: 'No schedule found' });
      }

      res.json({ success: true, schedule: userSchedule });
  } catch (error) {
      console.error('Error fetching schedule:', error);
      res.status(500).json({ success: false, message: 'Server error' });
  }
});
app.get('/questions/:questionId', async (req, res) => {
  try {
    const questionId = req.params.questionId;

    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    res.json({ success: true, question: question });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Reschedule endpoint
app.post('/reschedule/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { date } = req.body;

    // Get user's proficiency levels
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get completed questions for the day
    const completedQuestions = await Performance.find({
      userId,
      date: { $gte: new Date(date).setHours(0,0,0,0), $lt: new Date(date).setHours(23,59,59,999) },
      status: 'completed'
    });

    // Get user's schedule
    const schedule = await Schedule.findOne({ userId });
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    // Generate new schedule for remaining questions
    const remainingQuestions = await Question.find({
      _id: { $nin: completedQuestions.map(q => q.questionId) }
    });

    // Sort remaining questions by priority and difficulty
    const sortedQuestions = sortQuestions(remainingQuestions);

    // Get the next day's date
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // Update schedule with new questions
    const updatedSchedule = await Schedule.findOneAndUpdate(
      { userId },
      { 
        $push: { 
          'schedules.0.dates': {
            date: nextDay.toISOString().split('T')[0],
            questions: sortedQuestions.slice(0, 5).map(q => ({ // Limit to 5 questions per day
              questionId: q._id,
              status: 'pending'
            }))
          }
        }
      },
      { new: true }
    );

    res.json({ success: true, schedule: updatedSchedule });
  } catch (error) {
    console.error('Error rescheduling:', error);
    res.status(500).json({ success: false, message: 'Error rescheduling questions' });
  }
});

// Enhanced ML Recommendations endpoint
app.post("/api/enhanced-recommendations", async (req, res) => {
  try {
    console.log("Received recommendation request:", req.body); // Debug log

    const { userId, proficiencyData } = req.body;
    
    if (!userId) {
      console.log("Missing userId in request"); // Debug log
      return res.status(400).json({ error: "Missing userId" });
    }

    // Get all questions first
    const allQuestions = await Question.find({});
    console.log(`Found ${allQuestions.length} total questions`); // Debug log

    if (!allQuestions || allQuestions.length === 0) {
      console.log("No questions found in database"); // Debug log
      return res.status(404).json({ error: "No questions found in database" });
    }

    // Get user's performance data
    const performance = await Performance.findOne({ userId });
    console.log("User performance data:", performance ? "Found" : "Not found"); // Debug log
    
    // Calculate user's topic preferences based on history
    const topicPreferences = {};
    if (performance?.questions && Array.isArray(performance.questions)) {
      performance.questions.forEach(q => {
        if (q.questionId) {
          const question = allQuestions.find(aq => aq._id.toString() === q.questionId.toString());
          if (question && question.topic) {
            topicPreferences[question.topic] = (topicPreferences[question.topic] || 0) + 1;
          }
        }
      });
    }
    console.log("Topic preferences:", topicPreferences); // Debug log

    // Calculate difficulty adaptation based on success rate
    const difficultyLevels = ['easy', 'medium', 'hard'];
    let recommendedDifficulty = 'medium';
    if (performance?.questions && performance.questions.length > 0) {
      const completedQuestions = performance.questions.filter(q => q.status === 'completed');
      const successRate = completedQuestions.length / performance.questions.length;
      if (successRate > 0.7) recommendedDifficulty = 'hard';
      else if (successRate < 0.4) recommendedDifficulty = 'easy';
    }
    console.log("Recommended difficulty:", recommendedDifficulty); // Debug log

    // Filter out completed and skipped questions
    const completedQuestionIds = proficiencyData?.completedQuestions || [];
    const skippedQuestionIds = proficiencyData?.skippedQuestions || [];
    console.log("Completed questions:", completedQuestionIds.length); // Debug log
    console.log("Skipped questions:", skippedQuestionIds.length); // Debug log

    // Filter and score questions
    let recommendedQuestions = allQuestions
      .filter(q => {
        if (!q._id) return false;
        const qId = q._id.toString();
        return !completedQuestionIds.includes(qId) && !skippedQuestionIds.includes(qId);
      })
      .map(q => ({
        _id: q._id,
        topic: q.topic || 'Unknown',
        question: q.question || 'No question text',
        link: q.link || '',
        difficultylevel: (q.difficultylevel || 'medium').toLowerCase(),
        priority: q.priority || 0,
        score: calculateQuestionScore(q, topicPreferences, recommendedDifficulty)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    console.log(`Found ${recommendedQuestions.length} recommended questions`); // Debug log

    // If no questions are recommended, return some default questions
    if (recommendedQuestions.length === 0) {
      console.log("No recommended questions found, using difficulty-based fallback"); // Debug log
      recommendedQuestions = allQuestions
        .filter(q => (q.difficultylevel || 'medium').toLowerCase() === recommendedDifficulty)
        .slice(0, 5)
        .map(q => ({
          _id: q._id,
          topic: q.topic || 'Unknown',
          question: q.question || 'No question text',
          link: q.link || '',
          difficultylevel: (q.difficultylevel || 'medium').toLowerCase(),
          priority: q.priority || 0,
          score: 0
        }));
    }

    // If still no questions, return any 5 questions
    if (recommendedQuestions.length === 0) {
      console.log("No difficulty-based questions found, using any questions fallback"); // Debug log
      recommendedQuestions = allQuestions
        .slice(0, 5)
        .map(q => ({
          _id: q._id,
          topic: q.topic || 'Unknown',
          question: q.question || 'No question text',
          link: q.link || '',
          difficultylevel: (q.difficultylevel || 'medium').toLowerCase(),
          priority: q.priority || 0,
          score: 0
        }));
    }

    // Ensure we have at least one question
    if (recommendedQuestions.length === 0) {
      console.log("No questions found in any fallback, using first question"); // Debug log
      recommendedQuestions = [{
        _id: allQuestions[0]._id,
        topic: allQuestions[0].topic || 'Unknown',
        question: allQuestions[0].question || 'No question text',
        link: allQuestions[0].link || '',
        difficultylevel: (allQuestions[0].difficultylevel || 'medium').toLowerCase(),
        priority: allQuestions[0].priority || 0,
        score: 0
      }];
    }

    console.log("Final recommended questions:", recommendedQuestions.length); // Debug log

    res.json({ 
      questions: recommendedQuestions,
      metrics: {
        recommendedDifficulty,
        topicPreferences,
        totalQuestionsAttempted: performance?.questions?.length || 0
      }
    });

  } catch (error) {
    console.error("Error generating enhanced recommendations:", error);
    // Instead of returning 500, return some default questions
    try {
      console.log("Attempting fallback to default questions"); // Debug log
      const defaultQuestions = await Question.find({}).limit(5);
      if (defaultQuestions.length > 0) {
        console.log(`Found ${defaultQuestions.length} default questions`); // Debug log
        res.json({ 
          questions: defaultQuestions.map(q => ({
            _id: q._id,
            topic: q.topic || 'Unknown',
            question: q.question || 'No question text',
            link: q.link || '',
            difficultylevel: (q.difficultylevel || 'medium').toLowerCase(),
            priority: q.priority || 0,
            score: 0
          })),
          metrics: {
            recommendedDifficulty: 'medium',
            topicPreferences: {},
            totalQuestionsAttempted: 0
          }
        });
      } else {
        console.log("No default questions found, using dummy question"); // Debug log
        // If no questions in database, return a dummy question
        res.json({
          questions: [{
            _id: 'dummy',
            topic: 'General',
            question: 'Practice basic concepts',
            link: '',
            difficultylevel: 'medium',
            priority: 0,
            score: 0
          }],
          metrics: {
            recommendedDifficulty: 'medium',
            topicPreferences: {},
            totalQuestionsAttempted: 0
          }
        });
      }
    } catch (fallbackError) {
      console.error("Error in fallback:", fallbackError);
      // Last resort fallback
      console.log("Using last resort fallback"); // Debug log
      res.json({
        questions: [{
          _id: 'dummy',
          topic: 'General',
          question: 'Practice basic concepts',
          link: '',
          difficultylevel: 'medium',
          priority: 0,
          score: 0
        }],
        metrics: {
          recommendedDifficulty: 'medium',
          topicPreferences: {},
          totalQuestionsAttempted: 0
        }
      });
    }
  }
});

// Helper function to calculate question score
function calculateQuestionScore(question, topicPreferences, recommendedDifficulty) {
  let score = 0;
  
  // Topic preference score (0-40 points)
  const topicScore = (topicPreferences[question.topic] || 0) * 10;
  score += Math.min(topicScore, 40);
  
  // Difficulty match score (0-30 points)
  if (question.difficultylevel === recommendedDifficulty) {
    score += 30;
  } else if (Math.abs(difficultyLevels.indexOf(question.difficultylevel) - 
              difficultyLevels.indexOf(recommendedDifficulty)) === 1) {
    score += 15;
  }
  
  // Priority score (0-30 points)
  score += (question.priority || 0) * 3;
  
  return score;
}

// Get user analytics
app.get("/api/analytics/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const analytics = await Analytics.findOne({ userId });
    
    if (!analytics) {
      return res.json({
        dailyProgress: [],
        topicStats: [],
        streaks: { current: 0, longest: 0, lastActive: null },
        difficultyStats: {
          Easy: { completed: 0, attempted: 0 },
          Medium: { completed: 0, attempted: 0 },
          Hard: { completed: 0, attempted: 0 }
        }
      });
    }
    
    res.json(analytics);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// Update user analytics
app.post("/api/analytics/update", async (req, res) => {
  try {
    const { userId, questionId, timeSpent, status } = req.body;
    
    // Get question details
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }
    
    // Find or create analytics document
    let analytics = await Analytics.findOne({ userId });
    if (!analytics) {
      analytics = new Analytics({
        userId,
        dailyProgress: [],
        topicStats: [],
        streaks: { current: 0, longest: 0, lastActive: null },
        difficultyStats: {
          Easy: { completed: 0, attempted: 0 },
          Medium: { completed: 0, attempted: 0 },
          Hard: { completed: 0, attempted: 0 }
        }
      });
    }
    
    // Update daily progress
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let dailyEntry = analytics.dailyProgress.find(d => 
      new Date(d.date).getTime() === today.getTime()
    );
    
    if (!dailyEntry) {
      dailyEntry = {
        date: today,
        questionsCompleted: 0,
        timeSpent: 0,
        topics: []
      };
      analytics.dailyProgress.push(dailyEntry);
    }
    
    dailyEntry.timeSpent += timeSpent;
    if (status === 'completed') {
      dailyEntry.questionsCompleted++;
      
      // Update topic stats in daily progress
      let topicEntry = dailyEntry.topics.find(t => t.name === question.topic);
      if (topicEntry) {
        topicEntry.count++;
      } else {
        dailyEntry.topics.push({ name: question.topic, count: 1 });
      }
    }
    
    // Update topic stats
    let topicStat = analytics.topicStats.find(t => t.topic === question.topic);
    if (!topicStat) {
      topicStat = {
        topic: question.topic,
        completed: 0,
        attempted: 0,
        avgTimeSpent: 0
      };
      analytics.topicStats.push(topicStat);
    }
    
    topicStat.attempted++;
    if (status === 'completed') {
      topicStat.completed++;
    }
    topicStat.avgTimeSpent = ((topicStat.avgTimeSpent * (topicStat.attempted - 1)) + timeSpent) / topicStat.attempted;
    
    // Update difficulty stats
    analytics.difficultyStats[question.difficultylevel].attempted++;
    if (status === 'completed') {
      analytics.difficultyStats[question.difficultylevel].completed++;
    }
    
    // Update streaks
    const lastActive = new Date(analytics.streaks.lastActive);
    lastActive.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (!analytics.streaks.lastActive || lastActive.getTime() === yesterday.getTime()) {
      analytics.streaks.current++;
      analytics.streaks.longest = Math.max(analytics.streaks.current, analytics.streaks.longest);
    } else if (lastActive.getTime() !== today.getTime()) {
      analytics.streaks.current = 1;
    }
    analytics.streaks.lastActive = today;
    
    await analytics.save();
    res.json(analytics);
    
  } catch (error) {
    console.error("Error updating analytics:", error);
    res.status(500).json({ error: "Failed to update analytics" });
  }
});

app.post('/api/streak/update', async (req, res) => {
    try {
        const { userId } = req.body;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let streak = await Streak.findOne({ userId });
        if (!streak) {
            streak = new Streak({ userId });
        }

        const lastCompletionDate = streak.lastCompletionDate ? new Date(streak.lastCompletionDate) : null;
        lastCompletionDate?.setHours(0, 0, 0, 0);

        if (!lastCompletionDate) {
            // First completion
            streak.currentStreak = 1;
            streak.highestStreak = 1;
        } else {
            const dayDifference = Math.floor((today - lastCompletionDate) / (1000 * 60 * 60 * 24));
            
            if (dayDifference === 1) {
                // Consecutive day
                streak.currentStreak += 1;
                if (streak.currentStreak > streak.highestStreak) {
                    streak.highestStreak = streak.currentStreak;
                }
            } else if (dayDifference > 1) {
                // Streak broken
                streak.currentStreak = 1;
            }
            // If dayDifference === 0, it's the same day, don't update streak
        }

        streak.lastCompletionDate = today;
        await streak.save();

        res.json({
            currentStreak: streak.currentStreak,
            highestStreak: streak.highestStreak
        });
    } catch (error) {
        console.error('Error updating streak:', error);
        res.status(500).json({ error: 'Failed to update streak' });
    }
});

// GET endpoint for recommendations
app.get('/api/recommendations', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        // Get user's performance data
        const performance = await Performance.findOne({ userId });
        const completedQuestions = performance ? performance.completedQuestions : [];

        // Get all questions
        const allQuestions = await Question.find({});
        
        // Filter out completed questions
        const availableQuestions = allQuestions.filter(q => 
            !completedQuestions.includes(q._id.toString())
        );

        // Sort and limit to 5 questions
        const recommendations = sortQuestions(availableQuestions).slice(0, 5);

        res.json({
            recommendations: recommendations.map(q => ({
                _id: q._id,
                topic: q.topic,
                question: q.question,
                link: q.link,
                difficultylevel: q.difficultylevel,
                priority: q.priority,
                time: TIME_PER_QUESTION[q.difficultylevel] || 30
            }))
        });
    } catch (error) {
        console.error('Error getting recommendations:', error);
        res.status(500).json({ error: 'Failed to get recommendations' });
    }
});

// POST endpoint for recommendations with additional filters
app.post('/get-recommendations', async (req, res) => {
    try {
        const { userId, completedQuestions = [], skippedQuestions = [], date } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        // Get user's performance data
        const performance = await Performance.findOne({ userId });
        const userCompleted = performance ? performance.completedQuestions : [];

        // Get all questions
        const allQuestions = await Question.find({});
        
        // Filter out completed and skipped questions
        const availableQuestions = allQuestions.filter(q => {
            const qId = q._id.toString();
            return !userCompleted.includes(qId) && 
                   !completedQuestions.includes(qId) &&
                   !skippedQuestions.includes(qId);
        });

        // Sort and limit to 5 questions
        const recommendations = sortQuestions(availableQuestions).slice(0, 5);

        res.json({
            recommendations: recommendations.map(q => ({
                _id: q._id,
                topic: q.topic,
                question: q.question,
                link: q.link,
                difficultylevel: q.difficultylevel,
                priority: q.priority,
                time: TIME_PER_QUESTION[q.difficultylevel] || 30
            }))
        });
    } catch (error) {
        console.error('Error getting recommendations:', error);
        res.status(500).json({ error: 'Failed to get recommendations' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(port, (error) => {
    if (!error) {
        console.log('Server running on Port ' + port);
    } else {
        console.log(error);
    }
});