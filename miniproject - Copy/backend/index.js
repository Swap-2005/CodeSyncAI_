const port = 5000;
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const cron = require("node-cron");

app.use(express.json());
app.use(cors());
app.use(express.json());
mongoose.connect('mongodb://localhost:27017/Dsa-assistant');

// API creation
app.get('/', (req, res) => {
    res.send('Express App is running');
});



app.get("/api/recommendations", async (req, res) => {
  try {
      console.log("entered recc indexed.js");
      const userId = req.query.userId;
      console.log(userId);
      if (!userId) {
          return res.status(400).json({ error: "Missing userId" });
      }

      // Get user's performance data
      const performance = await Performance.findOne({ userId });
      
      // Get all questions
      const allQuestions = await Question.find({});
      
      // Filter out completed questions
      const recommendedQuestions = allQuestions.filter(q => 
          !performance?.questions.some(pq => 
              pq.questionId.toString() === q._id.toString() && 
              (pq.status === 'completed' || pq.skips > 0)
          )
      ).slice(0, 5); // Limit to 5 recommendations

      res.json({ questions: recommendedQuestions });

  } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

// New endpoint for POST recommendations
app.post("/get-recommendations", async (req, res) => {
  try {
      const { userId, completedQuestions, skippedQuestions, date } = req.body;
      console.log("POST /get-recommendations received:", { userId, completedQuestions, skippedQuestions, date });

      if (!userId) {
          return res.status(400).json({ error: "Missing userId" });
      }

      // Get user's performance data
      const performance = await Performance.findOne({ userId });
      
      // Get all questions from database
      const allQuestions = await Question.find({});
      
      // Filter out completed and skipped questions
      const excludedQuestions = [...(completedQuestions || []), ...(skippedQuestions || [])];
      
      // Get questions not yet attempted
      let recommendedQuestions = allQuestions.filter(question => 
          !excludedQuestions.includes(question._id.toString()) &&
          !performance?.questions.some(pq => 
              pq.questionId.toString() === question._id.toString() && 
              (pq.status === 'completed' || pq.skips > 0)
          )
      );

      // Sort by priority and difficulty
      recommendedQuestions = sortQuestions(recommendedQuestions);

      // Return top 5 recommendations
      recommendedQuestions = recommendedQuestions.slice(0, 5).map(q => ({
          _id: q._id,
          topic: q.topic,
          question: q.question,
          link: q.link,
          difficultylevel: q.difficultylevel,
          priority: q.priority,
          time: TIME_PER_QUESTION[q.difficultylevel] || 30
      }));

      console.log("Sending recommendations:", recommendedQuestions);
      res.json({ questions: recommendedQuestions });

  } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

// Middleware to fetch user
const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token');
    if (!token) {
        res.status(401).send({ errors: "please authenticate using valid token" });
    } else {
        try {
            const data = jwt.verify(token, 'secret_ecom');
            req.user = data.user;
            next();
        } catch (error) {
            res.status(401).send({ error: "Please authenticate using a valid token" });
        }
    }
};

// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String },
    email: { type: String, unique: true },
    password: { type: String },
    cartData: { type: Object },
    date: { type: Date, default: Date.now },
});

// User Model
const Users = mongoose.model('Users', UserSchema);

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
          id: user._id   // ✅ Ensure user ID is returned
      }
  };

  const token = jwt.sign(data, 'secret_ecom');

  res.json({ success: true, token, userId: user._id });  // ✅ Added userId in response
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
          
          // ✅ Include userId in response
          res.json({ success: true, token, userId: user._id });
      } else {
          res.json({ success: false, errors: "Wrong password" });
      }
  } else {
      res.json({ success: false, errors: 'Wrong email ID' });
  }
});


// Question Schema (MongoDB collection name will be 'questions' by default)
const QuestionSchema = new mongoose.Schema({
    topic: String,
    link: String,
    question: String,
    difficultylevel: String,
    priority: Number
});

// Question Model
const Question = mongoose.model("Question", QuestionSchema);

const TIME_PER_QUESTION = { Easy: 15, Medium: 25, Hard: 40 };
const PRIORITY_ORDER = [
    [1, "Easy"], [2, "Easy"],
    [1, "Medium"], [2, "Medium"],
    [1, "Hard"], [2, "Hard"],
    [3, "Easy"], [3, "Medium"], [3, "Hard"]
];

// Algorithm to generate schedule
const generateSchedule = async (userInput) => {
    let { proficiency, dailyTime, startDate, enoughTime } = userInput;

    // Fetch questions
    let questions = await Question.find({});

    // Filter questions based on proficiency level
    questions = filterByProficiency(questions, proficiency);

    // Sort questions by priority and difficulty
    questions = sortQuestions(questions);

    // Allocate questions to the schedule based on user input
    let schedule = allocateQuestions(questions, dailyTime, new Date(startDate), enoughTime);
    console.log(schedule)
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

// Sort questions based on priority and difficultylevel
const sortQuestions = (questions) => {
    return questions.sort((a, b) =>
        PRIORITY_ORDER.indexOf([a.priority, a.difficultylevel]) - PRIORITY_ORDER.indexOf([b.priority, b.difficultylevel])
    );
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
    const { questionId, newStatus } = req.body;
    console.log(questionId);

    const result = await Schedule.findOneAndUpdate(
      { "questions._id": questionId },
      { $set: { "questions.$.status": newStatus } },
      { new: true }
    );

    console.log(result);

    if (!result) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    res.json({ success: true, message: "Question status updated", updatedSchedule: result });
  } catch (error) {
    console.error("Error updating question status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Performance tracking schema
const QuestionPerformanceSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  status: { type: String, default: "pending" },
  attempts: { type: Number, default: 0 },
  skips: { type: Number, default: 0 },
});

const PerformanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  questions: [QuestionPerformanceSchema],
  lastAttemptedAt: { type: Date },
});

const Performance = mongoose.model("Performance", PerformanceSchema);

// Save performance logic with fixes
app.post("/save-performance", async (req, res) => {
  try {
    const { userId, questionId, status, attempts, skips } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({ message: "Invalid userId or questionId" });
    }

    let performance = await Performance.findOne({ userId });

    if (!performance) {
      performance = new Performance({
        userId,
        questions: [{ questionId, status: status || "pending", attempts: attempts || 0, skips: skips || 0 }],
      });
    } else {
      const existingQuestionIndex = performance.questions.findIndex((q) => q.questionId.toString() === questionId);

      if (existingQuestionIndex !== -1) {
        // Update existing question using the index
        performance.questions[existingQuestionIndex].status = status || performance.questions[existingQuestionIndex].status;
        performance.questions[existingQuestionIndex].attempts = attempts !== undefined ? attempts : performance.questions[existingQuestionIndex].attempts;
        performance.questions[existingQuestionIndex].skips = skips !== undefined ? skips : performance.questions[existingQuestionIndex].skips; // Correctly update skips

      } else {
        // Add new question if not found
        performance.questions.push({ questionId, status: status || "pending", attempts: attempts || 0, skips: skips || 0 });
      }
    }

    await performance.save();
    res.json({ message: "Performance data saved successfully!", performance });
  } catch (error) {
    console.error("Error saving performance:", error);
    res.status(500).json({ message: "Server error" });
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

app.listen(port, (error) => {
    if (!error) {
        console.log('server running on Port ' + port);
    } else {
        console.log(error);
    }
});