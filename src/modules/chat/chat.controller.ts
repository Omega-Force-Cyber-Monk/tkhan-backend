import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { SendMessageDto, StartConversationDto } from './dto/chat.dto';
@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}
  @Post('conversations') start(
    @CurrentUser() user: AuthUser,
    @Body() dto: StartConversationDto,
  ) {
    return this.chatService.start(user.sub, dto);
  }
  @Get('conversations') conversations(@CurrentUser() user: AuthUser) {
    return this.chatService.conversations(user.sub);
  }
  @Get('conversations/:id/messages') messages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.chatService.messages(user.sub, id);
  }
  @Post('messages') send(
    @CurrentUser() user: AuthUser,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.send(user.sub, dto);
  }
  @Patch('conversations/:id/read') markRead(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.chatService.markRead(user.sub, id);
  }
}
