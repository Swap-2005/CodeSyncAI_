import pandas as pd
import numpy as np
from pymongo import MongoClient
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from scipy.sparse.linalg import svds
from flask import Flask, jsonify, request
from flask_cors import CORS
from bson import ObjectId  # Fix MongoDB ObjectId issue
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

# Connect to MongoDB
try:
    client = MongoClient("mongodb://localhost:27017/")
    db = client["Dsa-assistant"]
    questions_col = db["questions"]
    performance_col = db["performances"]
    print("Successfully connected to MongoDB")
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
    raise

# Load questions from DB
def get_all_questions():
    try:
        questions = list(questions_col.find({}))
        print(f"Found {len(questions)} total questions in database")
        if questions:
            print("Sample question:", questions[0])
        return questions
    except Exception as e:
        print(f"Error getting questions: {e}")
        return []

# Load user performance from DB
def get_user_performance(user_id):
    try:
        print(f"Looking for user performance for user_id: {user_id}")
        # Try both userId and user_id formats
        user_perf = performance_col.find_one({"userId": user_id}) or performance_col.find_one({"user_id": user_id})
        
        if user_perf:
            print(f"Found user performance with {len(user_perf.get('questions', []))} questions")
            print("Full performance data:", user_perf)
            # Ensure questions array exists
            if 'questions' not in user_perf:
                user_perf['questions'] = []
            return user_perf
        else:
            print("No user performance found")
            return None
    except Exception as e:
        print(f"Error getting user performance: {e}")
        return None

# Compute TF-IDF Similarity
def get_question_similarity_matrix(questions):
    corpus = [q["topic"] + " " + q["difficultyLevel"] for q in questions]
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(corpus)
    similarity_matrix = cosine_similarity(tfidf_matrix)
    return similarity_matrix

# Collaborative Filtering using Matrix Factorization (SVD)
def collaborative_filtering(user_perf, questions):
    try:
        question_ids = [str(q["_id"]) for q in questions]
        print(f"Processing {len(question_ids)} questions for collaborative filtering")
        
        # Create user-question interaction matrix
        interaction_matrix = pd.DataFrame(0, index=[str(user_perf.get("userId") or user_perf.get("user_id"))], columns=question_ids)
        
        # Populate with user performance data
        for q in user_perf.get("questions", []):
            q_id = str(q.get("questionId") or q.get("question_id"))
            if q_id in interaction_matrix.columns:
                score = 1 if q.get("status") == "completed" else -1 if q.get("skips", 0) > 0 else 0
                interaction_matrix[q_id] = score
        
        # Convert to matrix for SVD
        matrix = interaction_matrix.to_numpy(dtype=np.float32)
        print("Interaction matrix created:", matrix)
        
        try:
            U, sigma, Vt = svds(matrix, k=min(1, matrix.shape[1] - 1))  # Avoid zero-dimension error
            predicted_scores = np.dot(U, np.dot(np.diag(sigma), Vt))
            scores_df = pd.DataFrame(predicted_scores, index=interaction_matrix.index, columns=interaction_matrix.columns)
            return scores_df.loc[str(user_perf.get("userId") or user_perf.get("user_id"))].sort_values(ascending=False)
        except Exception as e:
            print(f"Error in SVD: {e}")
            return pd.Series(0, index=question_ids)  # Return zero scores if SVD fails
    except Exception as e:
        print(f"Error in collaborative filtering: {e}")
        return pd.Series(0, index=question_ids)

class EnhancedRecommendationSystem:
    def __init__(self):
        self.scaler = StandardScaler()
        self.model = NearestNeighbors(n_neighbors=5, algorithm='ball_tree')
        self.topic_weights = {
            'arrays': 1.2,
            'linked_lists': 1.1,
            'trees': 1.3,
            'graphs': 1.4,
            'dynamic_programming': 1.5,
            'sorting': 1.0,
            'searching': 1.0,
            'recursion': 1.2
        }

    def process_user_history(self, history_data):
        df = pd.DataFrame(history_data)
        features = [
            'completion_rate',
            'avg_time_per_question',
            'difficulty_score',
            'topic_mastery'
        ]
        return self.scaler.fit_transform(df[features])

    def generate_recommendations(self, user_profile, analytics_data):
        # Calculate user's current level
        proficiency_score = self._calculate_proficiency(analytics_data)
        
        # Get topic weights based on user's weak areas
        topic_weights = self._get_topic_weights(analytics_data)
        
        # Generate personalized question set
        recommendations = self._generate_question_set(
            proficiency_score,
            topic_weights,
            analytics_data.get('daily_time_available', 120)
        )
        
        return recommendations

    def _calculate_proficiency(self, analytics_data):
        questions_completed = analytics_data.get('questions_completed', 0)
        success_rate = analytics_data.get('success_rate', 0.7)
        streak = analytics_data.get('current_streak', 0)
        
        base_score = questions_completed * success_rate
        streak_bonus = min(streak * 0.1, 0.5)  # Cap streak bonus at 50%
        
        return min(base_score + streak_bonus, 10)  # Cap at 10

    def _get_topic_weights(self, analytics_data):
        topic_scores = analytics_data.get('topic_distribution', {})
        weights = self.topic_weights.copy()
        
        for topic, score in topic_scores.items():
            if score < 0.6:  # Increase weight for weak topics
                weights[topic] *= 1.5
            elif score > 0.8:  # Decrease weight for strong topics
                weights[topic] *= 0.8
                
        return weights

    def _generate_question_set(self, proficiency, topic_weights, daily_time):
        question_set = []
        total_time = 0
        
        # Calculate number of questions based on proficiency and available time
        avg_question_time = 20  # minutes
        num_questions = min(int(daily_time / avg_question_time), 10)
        
        # Adjust difficulty based on proficiency
        difficulty_distribution = self._get_difficulty_distribution(proficiency)
        
        # Generate questions
        for _ in range(num_questions):
            difficulty = np.random.choice(['easy', 'medium', 'hard'], p=difficulty_distribution)
            topic = max(topic_weights.items(), key=lambda x: x[1])[0]
            
            question = {
                'topic': topic,
                'difficulty': difficulty,
                'estimated_time': avg_question_time
            }
            question_set.append(question)
            total_time += avg_question_time
            
            # Reduce weight of selected topic for variety
            topic_weights[topic] *= 0.8
            
        return question_set

    def _get_difficulty_distribution(self, proficiency):
        if proficiency < 3:
            return [0.7, 0.2, 0.1]  # Mostly easy
        elif proficiency < 7:
            return [0.3, 0.5, 0.2]  # Balanced
        else:
            return [0.1, 0.3, 0.6]  # Mostly hard

# Initialize the recommendation system
recommendation_system = EnhancedRecommendationSystem()

def get_recommendations(user_data):
    return recommendation_system.generate_recommendations(
        user_data.get('profile', {}),
        user_data.get('analytics', {})
    )

# Final Recommendation Logic
@app.route("/recommend", methods=["GET"])
def recommend_questions():
    try:
        print("entered ml_model")
        user_id = request.args.get("user_id")  # Get user_id from query params
        print(f"Received user_id: {user_id}")
        
        if not user_id:
            return jsonify({"error": "User ID is required"}), 400

        user_perf = get_user_performance(user_id)
        if not user_perf:
            print("No user performance found, returning empty list")
            return jsonify({"questions": []})  # Return empty list if user data is missing
        
        questions = get_all_questions()
        if not questions:
            print("No questions found in database")
            return jsonify({"questions": []})
            
        question_ids = [str(q["_id"]) for q in questions]
        print(f"Processing {len(question_ids)} questions for recommendations")
        
        # Get similarity scores
        similarity_matrix = get_question_similarity_matrix(questions)
        print("Computed similarity matrix")
        
        # Get collaborative filtering scores
        collab_scores = collaborative_filtering(user_perf, questions)
        print("Computed collaborative filtering scores")
        
        # Combine scores using weighted sum
        question_scores = {q_id: 0 for q_id in question_ids}  # Initialize scores
        
        for i, q in enumerate(user_perf.get("questions", [])):
            q_id = str(q.get("questionId") or q.get("question_id"))
            if q_id in question_ids:
                idx = question_ids.index(q_id)
                for j, q_sim_id in enumerate(question_ids):
                    if q_sim_id != q_id:
                        similarity_score = similarity_matrix[idx][j]
                        collab_score = collab_scores.get(q_sim_id, 0)
                        weight = 0.6 if q.get("status") == "pending" else 0.4  # Higher weight for pending questions
                        question_scores[q_sim_id] += (similarity_score * 0.7) + (collab_score * 0.3) * weight

        # Sort recommendations
        sorted_recommendations = sorted(question_scores.items(), key=lambda x: x[1], reverse=True)
        print(f"Sorted {len(sorted_recommendations)} recommendations")
        
        # Fetch top recommendations
        recommended_question_ids = [ObjectId(rec[0]) for rec in sorted_recommendations[:5]]  # Convert to ObjectId
        recommended_questions = list(questions_col.find({"_id": {"$in": recommended_question_ids}}))
        print(f"Found {len(recommended_questions)} recommended questions")
        
        # Return as JSON response
        return jsonify({"questions": recommended_questions})
    except Exception as e:
        print(f"Error in recommend_questions: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(port=5001, debug=True)
