# Image Integration Testing Playbook

## Test Rules
- Use base64-encoded images for all tests
- Accepted formats: JPEG, PNG, WEBP only
- Images must contain real visual features
- Resize large images to reasonable bounds

## Test the scan endpoint
```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
TOKEN=<admin_token>

# Test with a base64 image of a scorecard
curl -X POST "$API_URL/api/courses/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"image_base64": "<base64_image>"}'
```

## Expected response
```json
{
  "course_name": "Course Name",
  "num_holes": 18,
  "holes": [
    {"hole": 1, "par": 4, "yardage": 380},
    ...
  ]
}
```
