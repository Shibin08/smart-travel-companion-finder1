from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Match, Review, ReviewVote, User
from schemas import ReviewCreate, ReviewListResponse, ReviewResponse, ReviewUpdate, ReviewCategories

router = APIRouter(prefix="/reviews", tags=["Reviews"])


def _to_response(review: Review) -> ReviewResponse:
    return ReviewResponse(
        review_id=review.review_id,
        reviewer_id=review.reviewer_id,
        reviewee_id=review.reviewee_id,
        match_id=review.match_id,
        rating=review.rating,
        comment=review.comment,
        categories=ReviewCategories(
            communication=review.communication,
            reliability=review.reliability,
            compatibility=review.compatibility,
            overall=review.overall,
        ),
        is_public=review.is_public,
        helpful_votes=review.helpful_votes,
        created_at=review.created_at,
        updated_at=review.updated_at,
    )


@router.get("", response_model=ReviewListResponse)
def list_reviews(
    reviewee_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Review).filter(Review.reviewee_id == reviewee_id)

    if current_user.user_id != reviewee_id:
        query = query.filter(Review.is_public == True)

    reviews = query.order_by(Review.created_at.desc()).all()
    return {"total": len(reviews), "reviews": [_to_response(item) for item in reviews]}


@router.post("", response_model=ReviewResponse, status_code=201)
def create_review(
    body: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.reviewee_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot review yourself")

    reviewee = db.query(User).filter(User.user_id == body.reviewee_id).first()
    if not reviewee:
        raise HTTPException(status_code=404, detail="Reviewee not found")

    # Reviewer must have an accepted match with the reviewee.
    match_query = (
        db.query(Match)
        .filter(
            Match.status == "accepted",
            or_(
                (Match.user1_id == current_user.user_id) & (Match.user2_id == body.reviewee_id),
                (Match.user1_id == body.reviewee_id) & (Match.user2_id == current_user.user_id),
            ),
        )
    )
    if body.match_id is not None:
        match_query = match_query.filter(Match.match_id == body.match_id)

    match = match_query.first()
    if not match:
        if body.match_id is None:
            raise HTTPException(
                status_code=403,
                detail="You can only review users you have an accepted match with",
            )
        raise HTTPException(status_code=403, detail="Invalid or non-accepted match for this review")

    existing = (
        db.query(Review)
        .filter(
            Review.reviewer_id == current_user.user_id,
            Review.reviewee_id == body.reviewee_id,
            Review.match_id == body.match_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="You have already reviewed this user for this match")

    review = Review(
        reviewer_id=current_user.user_id,
        reviewee_id=body.reviewee_id,
        match_id=body.match_id,
        rating=body.rating,
        comment=body.comment,
        communication=body.categories.communication,
        reliability=body.categories.reliability,
        compatibility=body.categories.compatibility,
        overall=body.categories.overall,
        is_public=body.is_public,
    )

    db.add(review)
    db.commit()
    db.refresh(review)

    return _to_response(review)


@router.patch("/{review_id}", response_model=ReviewResponse)
def update_review(
    review_id: int,
    body: ReviewUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.query(Review).filter(Review.review_id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review.reviewer_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only reviewer can update this review")

    if body.rating is not None:
        review.rating = body.rating
    if body.comment is not None:
        review.comment = body.comment
    if body.categories is not None:
        review.communication = body.categories.communication
        review.reliability = body.categories.reliability
        review.compatibility = body.categories.compatibility
        review.overall = body.categories.overall
    if body.is_public is not None:
        review.is_public = body.is_public

    review.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(review)

    return _to_response(review)


@router.delete("/{review_id}", status_code=204)
def delete_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.query(Review).filter(Review.review_id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review.reviewer_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only reviewer can delete this review")

    db.delete(review)
    db.commit()


@router.post("/{review_id}/helpful", response_model=ReviewResponse)
def vote_helpful(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.query(Review).filter(Review.review_id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review.reviewer_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot vote your own review")

    # Check if user already voted
    existing_vote = (
        db.query(ReviewVote)
        .filter(ReviewVote.review_id == review_id, ReviewVote.user_id == current_user.user_id)
        .first()
    )
    if existing_vote:
        raise HTTPException(status_code=400, detail="You have already voted this review as helpful")

    # Record the vote
    vote = ReviewVote(review_id=review_id, user_id=current_user.user_id)
    db.add(vote)

    review.helpful_votes += 1
    db.commit()
    db.refresh(review)

    return _to_response(review)
