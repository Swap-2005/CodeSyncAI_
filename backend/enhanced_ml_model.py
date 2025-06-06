import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd
from datetime import datetime, timedelta

class EnhancedRecommendationSystem:
    def __init__(self):
        self.scaler = StandardScaler()
        
    def calculate_user_profile(self, user_history):
        """Calculate user profile based on their history"""
        profile = {
            'topic_preferences': self._calculate_topic_preferences(user_history),
            'difficulty_level': self._calculate_difficulty_level(user_history),
            'learning_pace': self._calculate_learning_pace(user_history),
            'success_rate': self._calculate_success_rate(user_history),
            'time_availability': self._calculate_time_availability(user_history)
        }
        return profile
    
    def _calculate_topic_preferences(self, history):
        """Calculate topic preferences based on successful completions and time spent"""
        topic_scores = {}
        for entry in history:
            topic = entry['topic']
            success = entry['completed']
            time_spent = entry['timeSpent']
            
            if topic not in topic_scores:
                topic_scores[topic] = {'attempts': 0, 'successes': 0, 'total_time': 0}
            
            topic_scores[topic]['attempts'] += 1
            topic_scores[topic]['successes'] += 1 if success else 0
            topic_scores[topic]['total_time'] += time_spent
        
        # Calculate preference scores
        preferences = {}
        for topic, scores in topic_scores.items():
            success_rate = scores['successes'] / scores['attempts']
            avg_time = scores['total_time'] / scores['attempts']
            preferences[topic] = (success_rate * 0.7 + (1/avg_time) * 0.3)
        
        return preferences
    
    def _calculate_difficulty_level(self, history):
        """Determine appropriate difficulty level based on performance"""
        difficulty_success = {'Easy': [], 'Medium': [], 'Hard': []}
        
        for entry in history:
            if entry['completed']:
                difficulty_success[entry['difficulty']].append(1)
            else:
                difficulty_success[entry['difficulty']].append(0)
        
        difficulty_rates = {}
        for diff, results in difficulty_success.items():
            if results:
                success_rate = sum(results) / len(results)
                difficulty_rates[diff] = success_rate
        
        return self._determine_appropriate_difficulty(difficulty_rates)
    
    def _determine_appropriate_difficulty(self, rates):
        """Determine next appropriate difficulty level"""
        if rates.get('Hard', 0) > 0.7:
            return 'Hard'
        elif rates.get('Medium', 0) > 0.7:
            return 'Medium'
        else:
            return 'Easy'
    
    def _calculate_learning_pace(self, history):
        """Calculate user's learning pace"""
        if not history:
            return 'normal'
            
        questions_per_day = {}
        for entry in history:
            date = entry['date'].split('T')[0]
            questions_per_day[date] = questions_per_day.get(date, 0) + 1
        
        avg_questions = sum(questions_per_day.values()) / len(questions_per_day)
        
        if avg_questions > 5:
            return 'fast'
        elif avg_questions < 2:
            return 'slow'
        else:
            return 'normal'
    
    def _calculate_success_rate(self, history):
        """Calculate overall success rate"""
        if not history:
            return 0.0
            
        successes = sum(1 for entry in history if entry['completed'])
        return successes / len(history)
    
    def _calculate_time_availability(self, history):
        """Analyze user's time availability patterns"""
        time_patterns = {}
        for entry in history:
            hour = datetime.fromisoformat(entry['date']).hour
            time_patterns[hour] = time_patterns.get(hour, 0) + 1
        
        return max(time_patterns.items(), key=lambda x: x[1])[0] if time_patterns else 12
    
    def generate_recommendations(self, user_profile, available_questions, n_recommendations=5):
        """Generate personalized question recommendations"""
        question_scores = []
        
        for question in available_questions:
            score = self._calculate_question_score(question, user_profile)
            question_scores.append((question, score))
        
        # Sort by score and return top n recommendations
        question_scores.sort(key=lambda x: x[1], reverse=True)
        return [q[0] for q in question_scores[:n_recommendations]]
    
    def _calculate_question_score(self, question, user_profile):
        """Calculate a score for a question based on user profile"""
        score = 0
        
        # Topic preference
        topic_score = user_profile['topic_preferences'].get(question['topic'], 0)
        score += topic_score * 0.3
        
        # Difficulty match
        difficulty_match = 1 if question['difficulty'] == user_profile['difficulty_level'] else 0.5
        score += difficulty_match * 0.3
        
        # Learning pace adjustment
        if user_profile['learning_pace'] == 'fast':
            pace_score = 1 if question['difficulty'] in ['Medium', 'Hard'] else 0.5
        elif user_profile['learning_pace'] == 'slow':
            pace_score = 1 if question['difficulty'] == 'Easy' else 0.5
        else:
            pace_score = 0.8
        score += pace_score * 0.2
        
        # Success rate consideration
        if user_profile['success_rate'] < 0.5 and question['difficulty'] == 'Hard':
            score *= 0.7
        
        return score
    
    def update_recommendations(self, user_profile, question_pool, user_feedback):
        """Update recommendations based on user feedback"""
        # Implement feedback-based updates
        pass 