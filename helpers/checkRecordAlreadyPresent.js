function checkMentorAlreadyPresent(ip_mentor_id,mentors)
{
    for (let i = 0; i < mentors.length; i++)
    {
        if (mentors[i].mentor_id === ip_mentor_id)
            return true;
    }

    return false;
}

function checkStudentAlreadyPresent(ip_student_id,students)
{
    for (let i = 0; i < students.length; i++)
    {
        if (students[i].student_id === ip_student_id)
            return true;
    }

    return false;
}

module.exports.checkMentorAlreadyPresent = checkMentorAlreadyPresent;
module.exports.checkStudentAlreadyPresent = checkStudentAlreadyPresent;