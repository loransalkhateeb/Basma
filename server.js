const express = require('express');
const sequelize = require('./Config/dbConnect');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const bodyParser = require('body-parser');
const client = require('./Utils/redisClient'); 
const AboutRoutes = require('./Routes/AboutRoutes');
const AboutTeacher = require('./Routes/AboutTeacherRoutes');
const AvailableCards = require('./Routes/AvailableCardsRoutes');
const BasmaTrainningRoutes = require('./Routes/BasmaTrainningRoutes');
const BlogsRoutes = require('./Routes/BlogRoutes');
const BoxSliderRoutes = require('./Routes/BoxSliderRoutes');
const SliderRoutes = require('./Routes/SliderRoutes');
const CommentBlogRoutes = require('./Routes/CommentBlogRoutes');
const CoursesRoutes = require('./Routes/CoursesRoutes');

const app = express();
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());


app.use('/abouts', AboutRoutes);
app.use('/aboutTeacher', AboutTeacher);
app.use('/availablecards', AvailableCards);
app.use('/basmatrainning', BasmaTrainningRoutes);
app.use('/blog', BlogsRoutes);
app.use('/boxSlider', BoxSliderRoutes);
app.use('/Sliders', SliderRoutes);
app.use('/commentBlogs', CommentBlogRoutes);
app.use('/Courses', CoursesRoutes);


process.on('SIGINT', () => {
  client.quit().then(() => {
    console.log('Redis connection closed');
    process.exit(0);
  });
});


sequelize.sync({ force: false }).then(() => {
  console.log('Database connected and synced!');
});


app.get("/", (req, res) => {
  res.send("Welcome to Basma Academy!");
});


app.listen(process.env.PORT || 6000, () => {
  console.log(`Server is running on port ${process.env.PORT || 6000}`);
});
