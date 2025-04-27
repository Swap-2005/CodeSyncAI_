import pandas as pd
import numpy as np
from pymongo import MongoClient
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from scipy.sparse.linalg import svds
from flask import Flask, jsonify, request
from flask_cors import CORS
from bson import ObjectId  # Fix MongoDB ObjectId issue

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
