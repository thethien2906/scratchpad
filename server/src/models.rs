use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProfilePublic {
    pub id: i64,
    pub name: String,
    pub avatar_color: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProjectSummary {
    pub id: i64,
    pub name: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateProfileRequest {
    pub name: String,
    pub avatar_color: Option<String>,
    pub pin: String,
    pub admin_secret: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UnlockRequest {
    pub profile_id: i64,
    pub pin: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub name: Option<String>,
    pub avatar_color: Option<String>,
    pub current_pin: Option<String>,
    pub new_pin: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeleteProfileRequest {
    pub pin: String,
}

#[derive(Debug, Deserialize)]
pub struct ContentRequest {
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct NameRequest {
    pub name: String,
}

#[derive(Serialize)]
pub struct ContentResponse {
    pub content: String,
}
