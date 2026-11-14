namespace Pakpost.Application.Common.Exceptions;
public sealed class AppException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public static AppException BadRequest(string msg) => new(400,msg);
    public static AppException Forbidden(string msg = "Forbidden") => new(403,msg);
    public static AppException NotFound(string msg = "Not found") => new(404,msg);
    public static AppException Conflict(string msg) => new(409,msg);
    public static AppException Unauthorized(string msg = "Unauthorized") => new(401,msg);
}
