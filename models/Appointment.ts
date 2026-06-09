import mongoose from "mongoose"

const AppointmentSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    age: String,
    sex: String,
    address: String,
    date: String,
    time: String,
  },
  { timestamps: true }
)

export default mongoose.models.Appointment ||
  mongoose.model("Appointment", AppointmentSchema)