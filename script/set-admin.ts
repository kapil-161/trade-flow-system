import "dotenv/config";
import { storage } from "../server/storage";

async function setAdmin() {
  const username = "kapil.bhattarai.161@gmail.com";
  
  try {
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      console.error(`User "${username}" not found. Please create the user first.`);
      process.exit(1);
    }
    
    const updatedUser = await storage.updateUser(user.id, {
      isAdmin: "true",
    });
    
    if (updatedUser) {
      console.log(`✅ Successfully set "${username}" as admin`);
      console.log(`User ID: ${updatedUser.id}`);
      console.log(`Admin status: ${updatedUser.isAdmin}`);
    } else {
      console.error("Failed to update user");
      process.exit(1);
    }
  } catch (error) {
    console.error("Error setting admin:", error);
    process.exit(1);
  }
}

setAdmin();
